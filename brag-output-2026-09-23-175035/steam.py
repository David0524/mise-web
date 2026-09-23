#!/usr/bin/env python3
# Regenerate the steam textures: uv run --with numpy python steam.py composition/assets/img
# (writes steam1..9; this cut uses steam1..7).
"""Deterministic steam plumes: seeded fractal noise, domain-warped upward, as white-on-alpha PNGs."""
import numpy as np, sys, zlib, struct

def smooth_noise(rng, h, w, cell):
    gh, gw = h // cell + 2, w // cell + 2
    g = rng.random((gh, gw))
    y = np.linspace(0, gh - 2, h, endpoint=False)
    x = np.linspace(0, gw - 2, w, endpoint=False)
    y0, x0 = y.astype(int), x.astype(int)
    fy, fx = y - y0, x - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
    top = a + (b - a) * fx[None, :]; bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]

def fbm(rng, h, w, base, octaves=5):
    out = np.zeros((h, w)); amp = 1.0; tot = 0.0; cell = base
    for _ in range(octaves):
        out += amp * smooth_noise(rng, h, w, max(2, int(cell))); tot += amp
        amp *= 0.5; cell /= 2
    return out / tot

def plume(seed, w=768, h=1536):
    rng = np.random.default_rng(seed)
    warp = fbm(rng, h, w, 180)
    # Anisotropic: noise built short and stretched tall, so the wisps streak upward.
    n = np.repeat(fbm(rng, h // 4, w, 44), 4, axis=0)[:h]
    # Domain warp: shift each row horizontally by low-frequency noise so wisps curl.
    shift = ((warp - 0.5) * 220).astype(int)
    cols = (np.arange(w)[None, :] + shift) % w
    n = np.take_along_axis(n, cols, axis=1)
    detail = np.repeat(fbm(rng, h // 3, w, 18, 4), 3, axis=0)[:h]
    v = np.clip((n * 0.75 + detail * 0.35 - 0.40) * 2.4, 0, 1) ** 1.25
    # Vapour is soft: a few separable box-blur passes take the edge off the wisps.
    for _ in range(3):
        kx, ky = 5, 14
        v = np.cumsum(np.pad(v, ((0, 0), (kx, kx)), mode="wrap"), axis=1)
        v = (v[:, 2 * kx:] - v[:, :-2 * kx]) / (2 * kx)
        v = np.cumsum(np.pad(v, ((ky, ky), (0, 0)), mode="edge"), axis=0)
        v = (v[2 * ky:, :] - v[:-2 * ky, :]) / (2 * ky)
    v = v[:h, :w]
    yy = np.linspace(0, 1, h)[:, None]      # 0 at top, 1 at bottom
    xx = np.linspace(-1, 1, w)[None, :]
    column = np.exp(-(xx / (0.36 + 0.55 * (1 - yy))) ** 2)  # narrow at the base, spreading as it rises
    fade = np.clip(yy * 1.6, 0, 1) * np.clip((1 - yy) * 5, 0, 1)
    a = np.clip(v * column * fade, 0, 1)
    return (a * 255).astype(np.uint8)

def write_png(path, alpha):
    h, w = alpha.shape
    rgba = np.zeros((h, w, 4), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = alpha
    raw = b"".join(b"\x00" + rgba[y].tobytes() for y in range(h))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)

out = sys.argv[1]
for i, seed in enumerate([11, 23, 37, 41, 53, 67, 79, 83, 97]):
    write_png("%s/steam%d.png" % (out, i + 1), plume(seed))
print("ok")
