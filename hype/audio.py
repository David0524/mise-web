"""Soundtrack: the music edit (two spans of Mixkit #190, spliced on the bar) plus
UI sound effects synthesized here, placed on the beats the picture moves on."""
import numpy as np, subprocess, wave
SR = 48000
def load(path, a, b):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
A = load("assets/music/190.mp3", 7.71, 49.71)
Bm = load("assets/music/190.mp3", 57.71 - .015, 74.71)
xf = int(.015 * SR); r = np.linspace(0, 1, xf)[:, None]
music = np.concatenate([A[:-xf], A[-xf:] * (1 - r) + Bm[:xf] * r, Bm[xf:]])
N = int(59 * SR); music = np.pad(music, ((0, max(0, N - len(music))), (0, 0)))[:N]
fo = int(2.5 * SR); music[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5

rng = np.random.default_rng(7)
T = lambda d: np.arange(int(d * SR)) / SR
def env(n, a=.002, d=.08):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)
def bp(x, lo, hi):       # crude FFT band-pass
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X[(f < lo) | (f > hi)] = 0; return np.fft.irfft(X, len(x))
def click(): n = int(.04 * SR); return bp(rng.standard_normal(n), 1800, 9000) * env(n, .0005, .006) * .5 + np.sin(2 * np.pi * 2200 * T(.04)) * env(n, .0005, .004) * .3
def tick(): n = int(.03 * SR); return np.sin(2 * np.pi * 3400 * T(.03)) * env(n, .0004, .005) * .35
def pop():
    t = T(.12); f = 300 + 600 * np.exp(-t / .02); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .001, .035) * .6
def shutter(): a = click(); b = click(); out = np.zeros(int(.09 * SR)); out[:len(a)] += a; out[int(.05 * SR):int(.05 * SR) + len(b)] += b * .8; return out
def paper(): n = int(.07 * SR); return bp(rng.standard_normal(n), 2500, 12000) * env(n, .003, .018) * .22
def whoosh(d=.5, lo=300, hi=3000, g=.25):
    n = int(d * SR); t = np.linspace(0, 1, n); e = np.sin(np.pi * t) ** 2
    return bp(rng.standard_normal(n), lo, hi) * e * g
def bloop(up=True):
    t = T(.18); f = (220 + 700 * t / .18) if up else (900 - 600 * t / .18); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .004, .06) * .4
def ding(f0=1318.5):
    t = T(1.0); return sum(np.sin(2 * np.pi * f0 * m * t) * a for m, a in [(1, 1), (2.01, .35), (3.02, .12)]) * env(len(t), .002, .25) * .22
def thump(): t = T(.4); return np.sin(2 * np.pi * (48 + 40 * np.exp(-t / .03)) * t) * env(len(t), .002, .12) * .9
def swell(d=.35): n = int(d * SR); t = np.linspace(0, 1, n); return bp(rng.standard_normal(n), 200, 5000) * t ** 3 * .35
def stretch(): t = T(.3); f = 160 + 260 * t / .3; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / .3) * .18

B = lambda b: b * .5
key = lambda: tick() * .45
# the demo runs on its own 40-beat clock; map its beats onto the film (same table as WARP in film.html)
SEGS = [(20, 7, 36, 19), (40, 19, 50, 27), (50, 27, 64, 39), (68, 39, 82, 50.55), (82, 50.55, 83, 51), (83, 51, 84, 52)]
def D(d):
    for f0, d0, f1, d1 in SEGS:
        if d0 <= d <= d1 and d1 > d0: return B(f0 + (d - d0) * (f1 - f0) / (d1 - d0))
    raise ValueError(d)
typing = lambda d0, d1, n: [(D(d0) + (D(d1) - D(d0)) * i / n, key()) for i in range(n)]
cues = [(B(1), whoosh(.9, 400, 2500, .14)), (B(3), pop()), (B(6), click()), (B(6), shutter()), (B(7), shutter()),
        *[(B(9) + i * .06, paper()) for i in range(4)], *[(B(10) + i * .06, paper()) for i in range(4)],
        (B(11), whoosh(.4, 600, 4000, .12)), (B(12), tick()), (B(13), click()), (B(16), thump()), (B(16.4), pop()),
        (B(20), whoosh(.4, 500, 4000, .14)),
        (D(8.2), click()), *typing(8.6, 11.1, 18), (D(11.6), click()), (D(12), bloop(True)), (D(12.9), pop()),
        *[(D(13) + i * .08, paper()) for i in range(3)], (D(14), click()), (D(14.05), whoosh(.35, 600, 5000, .14)), (D(14.3), pop()),
        *[(D(14.4) + i * .1, paper()) for i in range(3)], (D(17), click()), (D(17.5), click()), (D(18.1), click()),
        (B(36), whoosh(.3, 300, 3000, .1)), (B(40), whoosh(.35, 600, 5000, .12)), (D(20.4), tick()), (D(21), tick()), (D(26.2), click()), (D(27), whoosh(.35, 600, 5000, .12)),
        (D(28.6), click()), *typing(28.9, 30.6, 12), (D(30.9), pop() * .7), (D(31), whoosh(.4, 300, 3000, .12)), (D(32.4), pop()),
        *[(D(32.7) + i * .1, paper()) for i in range(3)], (D(36.4), click()), (D(37), whoosh(.35, 300, 3000, .1)), (D(37.3), ding()),
        (B(64), whoosh(.3, 300, 3000, .1)), (B(68), whoosh(.4, 300, 3000, .14)), (D(40.2), click()), (D(42), click()), (D(42.1), whoosh(.4, 300, 3000, .12)),
        *typing(42.7, 44.3, 14), (D(44.5), pop() * .7), (D(45.7), pop()), (D(50.3), swell(.4)), (D(51), thump()),
        (B(84), whoosh(.5, 200, 2000, .12)), (B(85), shutter()), (B(87), shutter()), (B(87.65), pop() * .7),
        (B(96), thump()), (B(96), whoosh(.4, 300, 3000, .12)), (B(100), whoosh(.4, 500, 4000, .12)),
        *[(B(100) + i * .05, paper()) for i in range(7)],
        *[(B(101) + i * B(.5), ding(f) * .55) for i, f in enumerate([523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77])],
        (B(104.6), whoosh(.3, 600, 5000, .1)), *[(B(105.6) + i * .14, tick()) for i in range(3)],
        (B(108), whoosh(.45, 300, 3000, .14)), (B(108.2), pop()), (B(110), pop()), (B(110.8), whoosh(.5, 500, 3000, .12)),
        (B(111.8), pop() * .7), (B(112.4), ding(1046.5) * .7)]
fx = np.zeros(N)
for t0, s in cues:
    i = int(t0 * SR); s = s[:N - i]; fx[i:i + len(s)] += s
mix = music * .9 + np.stack([fx, fx], 1) * .55
mix = np.clip(mix, -1, 1)
with wave.open("audio/mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", len(mix) / SR)
