#!/usr/bin/env python3
"""Whispered voice-over from a script, with exact line timings for the captions.

  python3 vo.py script.json out/vo.wav out/lines.json --voice en_US-ryan-high.onnx
               [--speed 1.12] [--voiced 0.08] [--sr 48000]

script.json: {"lines": [{"text": "Caption text.", "say": "optional spoken spelling", "pause": 0.4,
                         "at": 12.3 (optional absolute start), "speed": 1.2 (optional per line),
                         "voiced": 0.3 (optional per line)}], "lead": 0.6}

Each line is synthesised with Piper (a local neural TTS; `piper` must be on PATH or next to python), then
**whisperised**: an LPC analysis keeps the vocal-tract filter and replaces the voice source with noise, which
is how a real whisper is made. `voiced` mixes a little of the original back for body (0 = pure whisper).
Then: proximity bass, air shelf, gentle compression, a small dark room. Lines are placed back to back with
their pauses unless a line gives `at`. lines.json lists [start, end, text] per line in seconds; feed it to
the film as captions so picture, caption and voice share one clock.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile, wave
import numpy as np
from scipy.linalg import solve_toeplitz
from scipy.signal import lfilter, butter, sosfilt, fftconvolve, resample_poly


def piper(text, voice, speed, tmp):
    exe = shutil.which('piper') or os.path.join(os.path.dirname(sys.executable), 'piper')
    out = os.path.join(tmp, 'line.wav')
    subprocess.run([exe, '-m', voice, '-f', out, '--length-scale', str(speed), '--sentence-silence', '0'],
                   input=text.encode(), check=True, capture_output=True)
    w = wave.open(out); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
    return x, sr


def lpc(frame, order):
    r = np.correlate(frame, frame, 'full')[len(frame) - 1:len(frame) + order]
    if r[0] <= 1e-9: return np.r_[1, np.zeros(order)], 0.0
    r = r.copy(); r[0] *= 1.0001  # tiny white-noise floor keeps the solve stable
    c = solve_toeplitz(r[:order], -r[1:order + 1])
    a = np.r_[1, c]
    return a, max(float(np.dot(a, r[:order + 1])), 0.0)


def whisper(x, sr, voiced, seed=1):
    order, n, hop = 2 + sr // 1000, int(.03 * sr), int(.0075 * sr)
    win = np.hanning(n); rng = np.random.default_rng(seed)
    pre = lfilter([1, -.9], [1], x)
    out = np.zeros(len(x) + n); norm = np.zeros(len(x) + n)
    for s in range(0, len(x) - n, hop):
        fr = pre[s:s + n] * win
        a, err = lpc(fr, order)
        noise = rng.standard_normal(n) * np.sqrt(err / n)
        y = lfilter([1], a, noise) * win
        out[s:s + n] += y; norm[s:s + n] += win ** 2
    out = out[:len(x)] / np.maximum(norm[:len(x)], 1e-3)
    out = lfilter([1], [1, -.9], out)
    out *= np.sqrt(np.mean(x ** 2) / max(np.mean(out ** 2), 1e-12))
    return out * (1 - voiced) + x * voiced


def shelf(x, sr, f, gain_db, kind):
    sos = butter(2, f, 'highpass' if kind == 'high' else 'lowpass', fs=sr, output='sos')
    return x + (10 ** (gain_db / 20) - 1) * sosfilt(sos, x)


def compress(x, sr, thr_db=-24, ratio=3.0, win=.02):
    n = max(1, int(win * sr))
    env = np.sqrt(np.convolve(x ** 2, np.ones(n) / n, 'same'))
    lvl = 20 * np.log10(np.maximum(env, 1e-6)); over = np.maximum(lvl - thr_db, 0)
    gain = 10 ** (-over * (1 - 1 / ratio) / 20)
    gain = np.convolve(gain, np.ones(n) / n, 'same')
    return x * gain


def room(x, sr, t60=.45, wet=.13, seed=2):
    rng = np.random.default_rng(seed); n = int(t60 * sr)
    ir = rng.standard_normal(n) * np.exp(-6.9 * np.arange(n) / n)
    ir = sosfilt(butter(2, 3500, 'lowpass', fs=sr, output='sos'), ir); ir /= np.sqrt(np.sum(ir ** 2))
    return x + wet * fftconvolve(x, ir)[:len(x)]


def main():
    p = argparse.ArgumentParser()
    p.add_argument('script'); p.add_argument('out'); p.add_argument('lines')
    p.add_argument('--voice', required=True); p.add_argument('--speed', type=float, default=1.12)
    p.add_argument('--voiced', type=float, default=.08); p.add_argument('--sr', type=int, default=48000)
    a = p.parse_args()
    S = json.load(open(a.script)); lines = S['lines']; t = float(S.get('lead', .6))
    clips, timing = [], []
    with tempfile.TemporaryDirectory() as tmp:
        for L in lines:
            x, sr = piper(L.get('say', L['text']).replace('\n', ' '), a.voice, L.get('speed', a.speed), tmp)
            nz = np.where(np.abs(x) > .01)[0]
            if len(nz): x = x[max(0, nz[0] - int(.02 * sr)):nz[-1] + int(.06 * sr)]
            y = whisper(x, sr, L.get('voiced', a.voiced))
            y = resample_poly(y, a.sr, sr)
            if 'at' in L: t = float(L['at'])
            clips.append((t, y)); dur = len(y) / a.sr
            timing.append([round(t, 3), round(t + dur, 3), L['text']])
            t += dur + float(L.get('pause', .35))
    total = int((t + .5) * a.sr); mix = np.zeros(total)
    for st, y in clips:
        i = int(st * a.sr); mix[i:i + len(y)] += y[:max(0, total - i)]
    mix = shelf(mix, a.sr, 160, 3.5, 'low'); mix = shelf(mix, a.sr, 5500, 5, 'high')
    mix = compress(mix, a.sr); mix = room(mix, a.sr)
    mix *= .5 / max(np.max(np.abs(mix)), 1e-9)
    st = np.clip(np.stack([mix, mix], 1) * 32767, -32768, 32767).astype(np.int16)
    with wave.open(a.out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(a.sr); w.writeframes(st.tobytes())
    json.dump(timing, open(a.lines, 'w'), indent=1)
    for s, e, txt in timing: print(f'{s:6.2f}-{e:6.2f}  {txt}')
    print(f'total {t:.2f} s -> {a.out}')


if __name__ == '__main__':
    main()
