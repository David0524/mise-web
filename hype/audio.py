"""Soundtrack: the music edit (two spans of Mixkit #190, spliced on the bar) plus
UI sound effects synthesized here, placed on the beats the picture moves on."""
import numpy as np, subprocess, wave
SR = 48000
def load(path, a, b):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
A = load("assets/music/190.mp3", 7.71, 27.71)
Bm = load("assets/music/190.mp3", 57.71 - .015, 66.71)
xf = int(.015 * SR); r = np.linspace(0, 1, xf)[:, None]
music = np.concatenate([A[:-xf], A[-xf:] * (1 - r) + Bm[:xf] * r, Bm[xf:]])
N = int(29 * SR); music = np.pad(music, ((0, max(0, N - len(music))), (0, 0)))[:N]
fo = int(.35 * SR); music[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2

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
cues = [(B(1), whoosh(.9, 400, 2500, .14)), (B(3), pop()), (B(6), click()), (B(6), shutter()), (B(7), shutter()),
        *[(B(9) + i * .06, paper()) for i in range(4)], *[(B(10) + i * .06, paper()) for i in range(4)],
        (B(11), whoosh(.4, 600, 4000, .12)), (B(12), tick()), (B(13), click()), (B(16), thump()),
        *[(B(17) + i * .13, tick()) for i in range(7)], (B(19), bloop(False)), (B(19.95), pop()), (B(20), stretch()),
        (B(21), click()), *[(B(22) + i * .09, tick() * .5) for i in range(16)], (B(24), click()), (B(25), whoosh(.6, 300, 3000, .2)),
        (B(26), whoosh(.5, 200, 2000, .16)), (B(27), stretch()), (B(29), click()), (B(29.5), click()), (B(30), whoosh(.3, 800, 5000, .1)),
        (B(30.45), tick()), (B(30.75), tick()), (B(30.8), pop() * .6), (B(31), bloop(True)), (B(31.7), whoosh(.5, 500, 5000, .18)),
        (B(33), click() * .7), (B(34), pop()), *[(B(34.3) + i * .07, tick() * .4) for i in range(6)], (B(35), whoosh(.3, 800, 5000, .1)),
        (B(35.6), click()), (B(36), ding()), (B(37), tick()), (B(38), tick()), (B(39), ding(1568)), (B(39.6), swell(.5)),
        (B(43), shutter()), (B(45), shutter()), (B(45.65), pop() * .7), (B(52), thump()), (B(54), pop()), (B(54.8), whoosh(.5, 500, 3000, .12)),
        (B(55.8), pop() * .7)]
fx = np.zeros(N)
for t0, s in cues:
    i = int(t0 * SR); s = s[:N - i]; fx[i:i + len(s)] += s
mix = music * .9 + np.stack([fx, fx], 1) * .55
mix = np.clip(mix, -1, 1)
with wave.open("audio/mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", len(mix) / SR)
