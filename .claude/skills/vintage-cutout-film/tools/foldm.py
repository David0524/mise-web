#!/usr/bin/env python3
"""Curtain fold contrast, measured the same way on your frames and the reference's.

  python3 foldm.py frame1.jpg [frame2.png ...]

For an upper and a middle horizontal band it prints (relative fold contrast, detrended std, mean luma):
relative = mean (peak - trough) / peak between neighbouring extrema of the smoothed column profile; detrended
std = std of the profile minus a 55 px moving average (at 960 px width). Always run it on the reference's reveal
frames too and match their range: reviewers who each invent a metric give contradictory fixes.
"""
import sys
import numpy as np
from PIL import Image
def metrics(f, y0, y1, x0, x1):
    im = Image.open(f).convert('L').resize((960, 720))
    a = np.asarray(im).astype(float)[y0:y1, x0:x1].mean(0)
    s = np.convolve(np.pad(a, 4, mode='edge'), np.ones(9) / 9, 'valid')
    # round-8 metric: mean (peak - trough) / peak between local extrema
    from scipy.signal import argrelextrema
    mx = argrelextrema(s, np.greater, order=12)[0]; mn = argrelextrema(s, np.less, order=12)[0]
    rel = []
    for p in mx:
        lo = [m for m in mn if abs(m - p) < 80]
        if lo: rel.append((s[p] - min(s[m] for m in lo)) / max(s[p], 1))
    # round-7 metric: std of the profile minus an 54 px (960 scale) moving average
    k = 55; tr = np.convolve(np.pad(s, k // 2, mode='edge'), np.ones(k) / k, 'valid')
    return round(float(np.mean(rel)) if rel else 0, 3), round(float((s - tr).std()), 1), round(float(s.mean()))
for f in sys.argv[1:]:
    print(f.split('/')[-1], 'upper', metrics(f, 60, 170, 330, 870), 'mid', metrics(f, 300, 500, 330, 870))
