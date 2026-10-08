#!/usr/bin/env python3
"""Procedural score: an original lo-fi bed + synced sound effects, generated from a film's timed plan.

  node tools/plan.mjs film.film.js [words.json] --json plan.json
  python3 tools/score.py plan.json score.wav [--bpm 88] [--key F] [--seed 7] [--no-sfx] [--music-gain 1] [--sfx-gain 1]

Everything is synthesised here (no samples): felt-piano chords, a soft bass pulse, brushed snare and kick,
kitchen-ish percussion (spoon tap, glass clink), vinyl crackle, and a bell. The arrangement follows the plan:
  - sections before the first card are "unsettled": sparse, the phrase never resolves;
  - each card start gets an accent (stab + kick + clink), with near-silence between cards;
  - the beats after the last card settle into a steady groove that resolves;
  - spell letters get rising plucks; the resolve holds the tonic chord with a bell when the title lands.
SFX (unless --no-sfx): typing clicks under captions, a paper snap per flash, a whoosh per flood/conveyor,
soft ink thumps in scatter. Output: 48 kHz stereo 16-bit WAV, peak-normalised to -1 dBFS.
Needs numpy.
"""
import json, sys, wave
import numpy as np

args = sys.argv[1:]
def opt(k, d):
    if k in args:
        i = args.index(k); v = args[i + 1]; del args[i:i + 2]; return v
    return d
def flag(k):
    if k in args: args.remove(k); return True
    return False
BPM = float(opt('--bpm', 88)); KEY = opt('--key', 'F'); SEED = int(opt('--seed', 7))
MG = float(opt('--music-gain', 1)); SG = float(opt('--sfx-gain', 1)); NOSFX = flag('--no-sfx')
plan = json.load(open(args[0])); out = args[1]
SR = 48000; rng = np.random.default_rng(SEED)
beats = plan['beats']; DUR = plan['duration'] + 0.05
N = int(DUR * SR); L = np.zeros(N); R = np.zeros(N)
BEAT = 60 / BPM

# ── pitch helpers ──
NOTES = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11, 'Bb': 10, 'Eb': 3, 'Ab': 8}
ROOT = NOTES[KEY]
def hz(semi_from_c4): return 261.63 * 2 ** (semi_from_c4 / 12)
SCALE = [0, 2, 4, 5, 7, 9, 11]
def deg(d, octave=0):  # scale degree (0-based) in KEY, relative to C4 + octave
    o, k = divmod(d, 7); return ROOT + SCALE[k] + 12 * (o + octave)
def chord(d, octave=0, ext=(0, 2, 4, 6)):  # stacked thirds on degree d
    return [deg(d + e, octave) for e in ext]

def place(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    a, b = max(0, i), min(N, i + len(sig)); s = sig[a - i:b - i] * gain
    L[a:b] += s * np.sqrt((1 - pan) / 2) * 1.414 / 1.414; R[a:b] += s * np.sqrt((1 + pan) / 2)

def env(n, a=0.005, d=1.0, curve=4.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * t / max(d, 1e-3)); return e

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y
def lp_fast(x, cutoff):  # vectorised one-pole via cumulative filter approximation (good enough for noise shaping)
    k = int(max(1, SR / (2 * np.pi * cutoff))); ker = np.exp(-np.arange(k * 5) / k); ker /= ker.sum()
    return np.convolve(x, ker, mode='full')[:len(x)]

# ── instruments ──
def piano(semi, dur, vel=0.5):
    n = int((dur + 1.2) * SR); t = np.arange(n) / SR; f = hz(semi)
    s = np.zeros(n)
    for h, amp in ((1, 1), (2, .45), (3, .18), (4, .08), (5, .04)):
        s += amp * np.sin(2 * np.pi * f * h * t * (1 + 0.0004 * h * h)) * np.exp(-t * (1.2 + h * 0.9))
    s *= np.minimum(1, t / 0.012)                                       # felt: soft attack
    rel = np.ones(n); k = int(dur * SR); rel[k:] = np.exp(-np.arange(n - k) / SR * 6)
    return lp_fast(s * rel, 2600 + vel * 1500) * vel * 0.32

def bass(semi, dur, vel=0.6):
    n = int((dur + .3) * SR); t = np.arange(n) / SR; f = hz(semi)
    s = (np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t)) * env(n, .008, dur * .9, 2.5)
    return lp_fast(s, 600) * vel * 0.5

def kick(vel=0.7):
    n = int(.35 * SR); t = np.arange(n) / SR; f = 95 * np.exp(-t * 22) + 42
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, .28, 5) * vel * 0.9

def brush(vel=0.5, dur=.22):
    n = int(dur * SR); s = rng.standard_normal(n); s = s - lp_fast(s, 1800)        # high-passed noise
    e = np.minimum(1, np.arange(n) / (0.03 * SR)) * np.exp(-np.arange(n) / SR * 14)
    return s * e * vel * 0.16

def tap(vel=0.5, f=1250):  # wooden-spoon tap
    n = int(.09 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.7 * t)) * env(n, .001, .05, 6) * vel * 0.35

def clink(vel=0.4):  # light glass clink
    n = int(.9 * SR); t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in ((2637, 1, 6), (3951, .6, 9), (5274, .3, 14)))
    return s * np.minimum(1, t / .001) * vel * 0.12

def bell(semi, vel=0.5, dur=2.4):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(semi)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t * 2.5)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.6) * np.minimum(1, t / .003) * vel * 0.22

def pluck(semi, vel=0.5):
    n = int(.6 * SR); t = np.arange(n) / SR; f = hz(semi)
    return (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)) * env(n, .002, .35, 5) * vel * 0.28

# ── sfx ──
def click(vel=0.3):
    n = int(.018 * SR); s = rng.standard_normal(n) * env(n, .0005, .012, 5); return (s - lp_fast(s, 2500)) * vel * 0.25
def snap(vel=0.5):
    n = int(.12 * SR); s = rng.standard_normal(n); s = lp_fast(s, 5000) - lp_fast(s, 900)
    return s * env(n, .001, .06, 6) * vel * 0.6
def whoosh(dur=.6, vel=0.4, up=True):
    n = int(dur * SR); s = rng.standard_normal(n); t = np.arange(n) / n
    shape = np.sin(np.pi * t) ** 1.5; band = lp_fast(s, 1400 if up else 900) - lp_fast(s, 180)
    return band * shape * vel * 0.5
def thump(vel=0.4):
    n = int(.25 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 70 * t) * env(n, .002, .18, 5) + lp_fast(rng.standard_normal(n), 400) * env(n, .001, .08, 6) * .6) * vel * 0.6

# ── read the plan ──
sec_of = lambda b: b.get('section', 0)
cards = [b for b in beats if b['type'] == 'card']
first_card = cards[0]['start'] if cards else DUR * .35
last_card_end = (cards[-1]['start'] + cards[-1]['dur']) if cards else DUR * .55
resolve = next((b for b in beats if b['type'] == 'resolve'), None)
calm_start = last_card_end
end_start = resolve['start'] if resolve else DUR - 2.5

# ── music: unsettled section (0 → first card) ──
t, phrase = 0.15, [4, 6, 5, 3, 4, 8, 7]                       # meanders, never lands on the tonic
i = 0
while t < first_card - 0.3:
    place(piano(deg(phrase[i % len(phrase)], 1), BEAT * .9, .38 + .1 * rng.random()), t + rng.uniform(-.04, .06), pan=-.2)
    if i % 2 == 0: place(piano(deg([3, 1, 5][i // 2 % 3]), BEAT * 1.8, .3), t, pan=.1)       # IV/ii/vi, no tonic
    if rng.random() < .55: place(tap(.35 + .2 * rng.random(), 1100 + rng.integers(0, 400)), t + BEAT * rng.choice([.5, .75]), pan=.4)
    if i % 3 == 2: place(brush(.35), t + BEAT * .5, pan=-.3)
    t += BEAT * rng.choice([1, 1, 1.5]); i += 1

# ── music: method (card accents, near-silence between) ──
for k, c in enumerate(cards):
    at = c['start'] + 0.04
    for s in chord([3, 4, 0][k % 3], 0, (0, 2, 4)): place(piano(s, .5, .62), at)
    place(bass(deg([3, 4, 0][k % 3], -2), .45, .7), at)
    place(kick(.8), at); place(clink(.5), at + .02, pan=.35)

# ── music: calm groove (last card end → resolve) ──
prog = [0, 5, 3, 4]                                           # I – vi – IV – V
t, bar = calm_start, 0
while t < end_start - 0.05:
    d = prog[bar % 4]
    for s in chord(d): place(piano(s, BEAT * 1.9, .34), t, pan=-.1)
    for q in range(4):
        tt = t + q * BEAT
        if tt >= end_start: break
        place(bass(deg(d, -2) + (7 if q == 2 else 0), BEAT * .8, .6), tt)
        if q in (0, 2): place(kick(.55), tt)
        if q in (1, 3): place(brush(.45), tt, pan=.2)
        if q == 3: place(tap(.3), tt + BEAT * .5, pan=.45)
    melody = [4, 2, 0, 1] if bar % 2 == 0 else [2, 4, 7, 4]
    for q, m in enumerate(melody):
        if t + q * BEAT < end_start: place(piano(deg(m, 1), BEAT * .8, .3), t + q * BEAT + BEAT * .5, pan=.25)
    t += 4 * BEAT; bar += 1

# ── spell plucks (rise) ──
spell = [b for b in beats if b['type'] == 'spell']
for j, b in enumerate(spell): place(pluck(deg([0, 2, 4, 7][j % 4], 1), .55), b['start'] + .01, pan=-.3 + .2 * j)

# ── resolve: hold the tonic, bell when the title lands ──
if resolve:
    land = resolve['start'] + (resolve.get('gatherAt') or resolve['dur'] * .45) + (.25 if resolve.get('land') == 'snap' else 0)  # snap: the bell rings as the word lands, after the gather
    for s in chord(0, -1, (0, 2, 4, 6, 8)): place(piano(s, resolve['dur'] - .2, .38), resolve['start'] + .02)
    place(bass(deg(0, -2), resolve['dur'] - .3, .55), resolve['start'] + .02)
    place(bell(deg(0, 2), .55, min(2.4, DUR - land)), land, pan=.15)
    place(bell(deg(4, 1), .3, min(2.0, DUR - land)), land + .12, pan=-.15)

music_L, music_R = L.copy(), R.copy(); L[:] = 0; R[:] = 0

# ── vinyl bed ──
hiss = lp_fast(rng.standard_normal(N), 4000) * 0.006
L += hiss; R += hiss
for _ in range(int(DUR * 9)):
    place(click(rng.uniform(.05, .25)), rng.uniform(0, DUR), pan=rng.uniform(-.6, .6))
bed_L, bed_R = L.copy(), R.copy(); L[:] = 0; R[:] = 0

# ── sfx ──
if not NOSFX:
    for b in beats:
        st, ty = b['start'], b['type']
        if ty == 'flash': place(snap(.6), st)
        if ty in ('sentence', 'silhouette', 'card') and b.get('text'):
            for r, w in zip(b.get('reveal') or [], (b['text'] or '').split()):
                for ci in range(len(w)): place(click(.55), st + r['t'] + ci * .22 / max(1, len(w)) + rng.uniform(0, .01), pan=rng.uniform(-.2, .2))
        if ty == 'card': place(whoosh(.5, .35), st + .02 + b['dur'] * .05)
        if ty == 'ring':
            for h in b.get('hits') or []: place(tap(.55, 900), st + h[0] - .01, pan=rng.uniform(-.3, .3)); place(clink(.35), st + h[0] + .01, pan=rng.uniform(-.3, .3))  # ink hits
        if ty == 'conveyor': place(whoosh(min(.5, b['dur'] + .1), .3, up=False), st - .05, pan=-.3)
        if ty == 'scatter':
            for k in range(5): place(thump(.45), st + .25 + k * b['dur'] / 6, pan=rng.uniform(-.5, .5))
        if ty == 'hero': place(snap(.45), st)
sfx_L, sfx_R = L.copy(), R.copy()

mixL = MG * music_L + 0.8 * bed_L + SG * 0.7 * sfx_L
mixR = MG * music_R + 0.8 * bed_R + SG * 0.7 * sfx_R
# gentle glue: soft-clip then normalise to -1 dBFS; 25 ms fade in/out
for m in (mixL, mixR):
    m[:] = np.tanh(m * 1.6) / 1.6
fade = int(.025 * SR); ramp = np.linspace(0, 1, fade)
for m in (mixL, mixR): m[:fade] *= ramp; m[-fade:] *= ramp[::-1]
peak = max(np.abs(mixL).max(), np.abs(mixR).max(), 1e-9); g = 10 ** (-1 / 20) / peak
pcm = (np.stack([mixL, mixR], 1) * g * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f'{out}: {DUR:.2f}s, {BPM:g} bpm in {KEY}, {len(cards)} card accents, sfx={"off" if NOSFX else "on"}', file=sys.stderr)
