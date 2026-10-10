#!/usr/bin/env python3
"""An original, synthesised noir-lounge bed for a cutout film. No samples.

  python3 score.py cue.json out/music.wav [--sr 48000]

cue.json: {"bpm": 98, "key": "D", "stop": 45.3, "length": 48,
           "sections": [{"at": 0, "mood": "invocation"}, {"at": 8.2, "mood": "litany"},
                        {"at": 22, "mood": "litany+"}, {"at": 33.4, "mood": "reveal"}],
           "hits": [33.4, 36.3]}
Moods: invocation (felt-piano chords, bass drone, no drums, breathy pad), litany (brushes, walking upright
bass, electric piano comping), litany+ (the same, busier: ride swing and fills), reveal (drums out, a lush
held chord, bells, a slow swell). `hits` add a soft low boom with a cymbal swell into that time. At `stop`
everything is cut dead (a 15 ms fade), so the coda line plays in silence.
"""
import argparse, json, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(midi): return 440 * 2 ** ((midi - 69) / 12)


class Bus:
    def __init__(s, n, sr): s.l = np.zeros(n); s.r = np.zeros(n); s.sr = sr

    def add(s, t, sig, gain=1., pan=0.):
        i = int(t * s.sr)
        if i >= len(s.l) or i < 0: return
        sig = sig[:len(s.l) - i] * gain
        s.l[i:i + len(sig)] += sig * np.sqrt(.5 * (1 - pan)) * 1.414
        s.r[i:i + len(sig)] += sig * np.sqrt(.5 * (1 + pan)) * 1.414


def env(n, sr, a=.005, d=.3, s=0., r=.1, hold=None):
    t = np.arange(n) / sr
    e = np.where(t < a, t / a, 1.)
    dec = s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4))
    e = np.where(t >= a, dec, e)
    if hold is not None: e = e * np.clip(1 - (t - hold) / r, 0, 1)
    return e


def epiano(f, dur, sr, vel=.6):
    n = int((dur + .8) * sr); t = np.arange(n) / sr
    idx = 2.2 * vel * np.exp(-t / .35) + .25
    mod = np.sin(2 * np.pi * f * 1.0 * t) * idx
    tine = np.sin(2 * np.pi * f * 14 * t) * .05 * np.exp(-t / .04)
    car = np.sin(2 * np.pi * f * t + mod) + tine
    return car * env(n, sr, .004, 1.6, .25, .5, hold=dur) * vel


def felt(f, dur, sr, vel=.5):
    n = int((dur + 1.2) * sr); t = np.arange(n) / sr
    x = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (1.2 + k * .9)) / k ** 1.6 for k in range(1, 7))
    return x * env(n, sr, .012, 2.5, .0, .8, hold=dur) * vel


def bass(f, dur, sr, vel=.8):
    n = int((dur + .25) * sr); t = np.arange(n) / sr
    x = np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t) * np.exp(-t / .15) + .12 * np.sin(6 * np.pi * f * t) * np.exp(-t / .08)
    thump = np.sin(2 * np.pi * f * .5 * t) * np.exp(-t / .03) * .4
    return np.tanh((x + thump) * 1.3) * env(n, sr, .006, .5, .35, .12, hold=dur) * vel


def pad(freqs, dur, sr, vel=.25, seed=0):
    n = int((dur + 1.5) * sr); t = np.arange(n) / sr; rng = np.random.default_rng(seed)
    x = np.zeros(n)
    for f in freqs:
        for det in (-.12, .0, .13):
            x += np.sin(2 * np.pi * f * 2 ** (det / 12) * t + rng.random() * 6.28)
    noise = sosfilt(butter(2, [400, 2400], 'bandpass', fs=sr, output='sos'), rng.standard_normal(n)) * .25
    x = x / (3 * len(freqs)) + noise
    a = np.clip(t / 1.2, 0, 1) * np.clip(1 - (t - dur) / 1.5, 0, 1)
    return x * a * vel


def bell(f, sr, vel=.25):
    n = int(3 * sr); t = np.arange(n) / sr
    x = sum(np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) * g for r, d, g in ((1, 1.2, 1), (2.76, 2.5, .4), (5.4, 4, .2), (8.9, 6, .1)))
    return x * env(n, sr, .002, 9, 0, .1) * vel


def brush(sr, rng, kind='tap', vel=.4):
    if kind == 'swish':
        n = int(.45 * sr); t = np.arange(n) / sr
        x = sosfilt(butter(2, [2500, 9000], 'bandpass', fs=sr, output='sos'), rng.standard_normal(n))
        return x * np.sin(np.pi * t / t[-1]) ** 2 * vel * .5
    n = int(.18 * sr); t = np.arange(n) / sr
    x = sosfilt(butter(2, [1800, 7000], 'bandpass', fs=sr, output='sos'), rng.standard_normal(n))
    return x * np.exp(-t / .045) * vel


def ride(sr, rng, vel=.15):
    n = int(.9 * sr); t = np.arange(n) / sr
    x = sosfilt(butter(2, 5000, 'highpass', fs=sr, output='sos'), rng.standard_normal(n))
    x += .3 * sum(np.sin(2 * np.pi * f * t) for f in (3150, 4310, 5870))
    return x * np.exp(-t / .3) * vel


def kick(sr, vel=.5):
    n = int(.4 * sr); t = np.arange(n) / sr
    f = 48 + 60 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t / .16) * vel


def boom(sr, rng, vel=.6):
    n = int(2.5 * sr); t = np.arange(n) / sr
    f = 36 + 30 * np.exp(-t / .08)
    x = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t / .9)
    x += sosfilt(butter(2, 300, 'lowpass', fs=sr, output='sos'), rng.standard_normal(n)) * np.exp(-t / .3) * .3
    return x * vel


def swell(sr, rng, dur=1.4, vel=.2):
    n = int(dur * sr); t = np.arange(n) / sr
    x = sosfilt(butter(2, 4000, 'highpass', fs=sr, output='sos'), rng.standard_normal(n))
    return x * (t / dur) ** 3 * vel


def crackle(n, sr, rng, vel=.025):
    x = sosfilt(butter(2, [300, 3000], 'bandpass', fs=sr, output='sos'), rng.standard_normal(n)) * .15
    pops = np.zeros(n); idx = rng.integers(0, n, n // 2400); pops[idx] = rng.standard_normal(len(idx)) * 3
    pops = sosfilt(butter(2, 1500, 'highpass', fs=sr, output='sos'), pops)
    return (x + pops) * vel


def main():
    p = argparse.ArgumentParser(); p.add_argument('cue'); p.add_argument('out'); p.add_argument('--sr', type=int, default=48000)
    a = p.parse_args(); C = json.load(open(a.cue)); sr = a.sr
    bpm = C.get('bpm', 98); beat = 60 / bpm; bar = 4 * beat
    length = C.get('length', 48); stop = C.get('stop', length); n = int(length * sr)
    root = 48 + NOTE[C.get('key', 'D')]  # bass octave root (D3 = 50)
    rng = np.random.default_rng(C.get('seed', 5))
    keys, bs, drums, fx = Bus(n, sr), Bus(n, sr), Bus(n, sr), Bus(n, sr)
    # i  m9 - iv m9 - bVI maj7 - V7(b9): a minor-key lounge loop, in semitones from the root
    prog = [(0, [0, 3, 7, 10, 14]), (5, [0, 3, 7, 10, 14]), (8, [0, 4, 7, 11, 14]), (7, [0, 4, 7, 10, 13])]
    secs = sorted(C['sections'], key=lambda s: s['at'])

    def mood_at(t):
        m = secs[0]['mood']
        for s in secs:
            if t >= s['at']: m = s['mood']
        return m

    t = 0.; k = 0
    while t < stop:
        m = mood_at(t); deg, chord = prog[k % 4]; r = root + deg
        if m == 'reveal':
            break
        if m == 'invocation':
            for i, iv in enumerate(chord[:4]): keys.add(t + i * .03, felt(hz(r + 12 + iv), bar * .95, sr, .32), pan=-.3 + i * .2)
            bs.add(t, bass(hz(r - 12), bar * .9, sr, .55))
            fx.add(t, pad([hz(r + 12 + iv) for iv in chord[:3]], bar, sr, .1, seed=k))
        else:
            busy = m.endswith('+')
            # comping: two stabs per bar (swing)
            for off, v in ((0, .5), (beat * 2.66, .38)) if not busy else ((0, .5), (beat * 1.66, .32), (beat * 2.66, .4)):
                for i, iv in enumerate(chord): keys.add(t + off + i * .008, epiano(hz(r + 12 + iv), beat * 1.2, sr, v * .5), pan=-.35 + i * .15)
            # walking bass
            walk = [0, 7, 12 if busy else 10, 5 if deg != 7 else 6]
            for b in range(4):
                bs.add(t + b * beat, bass(hz(r - 12 + walk[b]), beat * .85, sr, .7 if b == 0 else .55))
            for b in range(4):
                drums.add(t + b * beat, brush(sr, rng, 'tap', .18 if b % 2 == 0 else .3), pan=.2)
                if b % 2 == 1: drums.add(t + b * beat - .05, brush(sr, rng, 'swish', .35), pan=.25)
                if busy:
                    drums.add(t + b * beat, ride(sr, rng, .1), pan=-.3); drums.add(t + b * beat + beat * .66, ride(sr, rng, .06), pan=-.3)
                if b in (0, 2): drums.add(t + b * beat, kick(sr, .35))
        t += bar; k += 1
    # reveal: the held chord, bells and a swell, until the stop
    rv = next((s['at'] for s in secs if s['mood'] == 'reveal'), None)
    if rv is not None:
        r = root
        held = stop - rv
        fx.add(rv, pad([hz(r + 12 + iv) for iv in (0, 7, 10, 14, 15)], held, sr, .22, seed=11))
        for i, iv in enumerate((0, 7, 10, 14, 17)): keys.add(rv + i * .06, felt(hz(r + 12 + iv), held, sr, .3), pan=-.4 + i * .2)
        bs.add(rv, bass(hz(r - 12), held, sr, .6))
        for j, iv in enumerate((14, 19, 22, 26)): fx.add(rv + 1.6 + j * 2.2, bell(hz(r + 24 + iv), sr, .12), pan=-.5 + j * .3)
    for h in C.get('hits', []):
        fx.add(h, boom(sr, rng, .55)); fx.add(h - 1.4, swell(sr, rng, 1.4, .12))
    # mix
    def rev(x, wet, t60=1.6, seed=3):
        r2 = np.random.default_rng(seed); m = int(t60 * sr); ir = r2.standard_normal(m) * np.exp(-6.9 * np.arange(m) / m)
        ir = sosfilt(butter(2, 5000, 'lowpass', fs=sr, output='sos'), ir); ir /= np.sqrt(np.sum(ir ** 2))
        return x + wet * fftconvolve(x, ir)[:len(x)]
    L = keys.l * .9 + bs.l * .8 + drums.l * .6 + fx.l * .9
    R = keys.r * .9 + bs.r * .8 + drums.r * .6 + fx.r * .9
    L, R = rev(L, .25), rev(R, .25, seed=4)
    cr = crackle(n, sr, rng); L += cr; R += np.roll(cr, 97)
    warm = butter(2, 9000, 'lowpass', fs=sr, output='sos'); L, R = sosfilt(warm, L), sosfilt(warm, R)
    # cut dead at stop
    i = int(stop * sr); fade = int(.015 * sr)
    for x in (L, R):
        x[i:i + fade] *= np.linspace(1, 0, len(x[i:i + fade])); x[i + fade:] = 0
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
    out = np.clip(np.stack([L, R], 1) / peak * .7 * 32767, -32768, 32767).astype(np.int16)
    with wave.open(a.out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(out.tobytes())
    print('wrote', a.out, f'{length:.1f} s, stop at {stop:.2f} s')


if __name__ == '__main__':
    main()
