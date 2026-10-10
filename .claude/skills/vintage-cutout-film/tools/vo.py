#!/usr/bin/env python3
"""Whispered voice-over from a script, with exact line timings for the captions.

  python3 vo.py script.json out/vo.wav out/lines.json --voice en_GB-alan-medium.onnx
               [--speed 0.88] [--voiced 0.3] [--sr 48000] [--best-of 4]

script.json: {"lines": [{"text": "Caption text.", "say": "optional spoken spelling", "pause": 0.4,
                         "at": 12.3 (optional absolute start), "speed": 1.2 (optional per line),
                         "voiced": 0.3 (optional per line)}], "lead": 0.6}

Each line is synthesised with Piper (a local neural TTS; `piper` must be on PATH or next to python), then
**whisperised**: an LPC analysis keeps the vocal-tract filter and replaces the voice source with noise, which
is how a real whisper is made. `voiced` mixes a little of the original back for body (0 = pure whisper).
Then: proximity bass, air shelf, gentle compression, a small dark room. Lines are placed back to back with
their pauses unless a line gives `at`. lines.json lists [start, end, text] per line in seconds; feed it to
the film as captions so picture, caption and voice share one clock.

Piper is not deterministic, so a line that came out clear can come out mumbled on the next run. --best-of N
records every line N times, transcribes each take (faster-whisper, as in asr.py) and keeps the take whose words
match the script best; then it transcribes every line in the finished mix (as asr.py does) and re-records the
lines that fail there, up to --verify-rounds times.
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


_asr = None


def score(y, sr, text):
    """Word match (0..1) between a lone take and its script line, judged through the mix chain."""
    pad = np.zeros(int(.3 * sr)); y = room(compress(shelf(shelf(np.r_[pad, y, pad], sr, 160, 3.5, 'low'), sr, 5500, 5, 'high'), sr), sr)
    return score_raw(y, sr, text)


def score_raw(y, sr, text):
    """Word match (0..1) between audio and a script line, via faster-whisper (the same normaliser as asr.py)."""
    global _asr
    import importlib.util, os
    from difflib import SequenceMatcher
    if _asr is None:
        from faster_whisper import WhisperModel
        spec = importlib.util.spec_from_file_location('asr', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'asr.py'))
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        _asr = (WhisperModel('small.en', device='cpu', compute_type='int8'), mod.words)
    model, words = _asr
    seg = resample_poly(y, 16000, sr).astype(np.float32)
    heard = ' '.join(t.text.strip() for t in model.transcribe(seg, language='en', beam_size=5)[0])
    return SequenceMatcher(None, words(text), words(heard)).ratio()


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
    p.add_argument('--voice', required=True); p.add_argument('--speed', type=float, default=.88)
    p.add_argument('--voiced', type=float, default=.3); p.add_argument('--sr', type=int, default=48000)
    p.add_argument('--best-of', type=int, default=1)
    p.add_argument('--verify-rounds', type=int, default=2, help='with --best-of: re-record lines that fail in the finished mix')
    a = p.parse_args()
    S = json.load(open(a.script)); lines = S['lines']
    tmp = tempfile.mkdtemp()

    def take(L, k):
        x, sr = piper(L.get('say', L['text']).replace('\n', ' '), a.voice, L.get('speed', a.speed), tmp)
        nz = np.where(np.abs(x) > .01)[0]
        if len(nz): x = x[max(0, nz[0] - int(.02 * sr)):nz[-1] + int(.06 * sr)]
        return resample_poly(whisper(x, sr, L.get('voiced', a.voiced), seed=1 + k), a.sr, sr)

    def build(ys):
        t = float(S.get('lead', .6)); clips, timing = [], []
        for L, y in zip(lines, ys):
            if 'at' in L: t = float(L['at'])
            clips.append((t, y)); timing.append([round(t, 3), round(t + len(y) / a.sr, 3), L['text']])
            t += len(y) / a.sr + float(L.get('pause', .35))
        mix = np.zeros(int((t + .5) * a.sr))
        for st, y in clips:
            i = int(st * a.sr); mix[i:i + len(y)] += y[:max(0, len(mix) - i)]
        mix = shelf(mix, a.sr, 160, 3.5, 'low'); mix = shelf(mix, a.sr, 5500, 5, 'high')
        mix = compress(mix, a.sr); mix = room(mix, a.sr)
        return mix * (.5 / max(np.max(np.abs(mix)), 1e-9)), timing, t

    def heard_in_mix(mix, s, e, text):   # the same window asr.py uses
        seg = mix[max(0, int((s - .1) * a.sr)):int((e + .15) * a.sr)]
        return score_raw(seg, a.sr, text)

    # first pass: best take of N, judged alone through the mix chain
    ys = []
    for L in lines:
        best, best_sc = None, -1
        for k in range(max(1, a.best_of)):
            y = take(L, k)
            if a.best_of <= 1: best = y; break
            sc = score(y, a.sr, L['text'])
            if sc > best_sc: best, best_sc = y, sc
            if sc >= .999: break
        ys.append(best)
    mix, timing, t = build(ys)
    # verify in the finished mix (neighbouring tails, compression, room) and re-record what fails there
    for rnd in range(a.verify_rounds if a.best_of > 1 else 0):
        scores = [heard_in_mix(mix, s, e, txt) for s, e, txt in timing]
        bad = [i for i, sc in enumerate(scores) if sc < .75]
        print(f'verify {rnd + 1}: ' + (', '.join(f'{lines[i]["text"]!r} {scores[i]:.2f}' for i in bad) or 'all lines pass'))
        if not bad: break
        for i in bad:
            best_y, best_sc = ys[i], scores[i]
            for k in range(a.best_of):
                cand = ys[:i] + [take(lines[i], 100 * (rnd + 1) + k)] + ys[i + 1:]
                m2, tm2, _ = build(cand)
                sc = heard_in_mix(m2, tm2[i][0], tm2[i][1], lines[i]['text'])
                if sc > best_sc: best_y, best_sc = cand[i], sc
                if sc >= .999: break
            ys[i] = best_y
        mix, timing, t = build(ys)
    st = np.clip(np.stack([mix, mix], 1) * 32767, -32768, 32767).astype(np.int16)
    with wave.open(a.out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(a.sr); w.writeframes(st.tobytes())
    json.dump(timing, open(a.lines, 'w'), indent=1)
    for s_, e, txt in timing: print(f'{s_:6.2f}-{e:6.2f}  {txt}')
    print(f'total {t:.2f} s -> {a.out}')


if __name__ == '__main__':
    main()
