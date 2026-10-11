#!/usr/bin/env python3
"""List the enclosed holes in cut-out PNGs and mark them, to catch matting lace before a reviewer does.

  python3 holes.py assets/cut/*.png [--sheet out/holes.jpg]

Every enclosed hole gets its own cream inner rim on screen. Real gaps (between an arm and the body, between legs,
inside rigging) are right; a cluster of small holes between hands, hats or hair is matting lace and reads as broken:
fill it with prep.py --fill-holes (fraction of the subject) or close an open one with an --add polygon.
"""
import argparse, os
import numpy as np
from PIL import Image
from scipy import ndimage

p = argparse.ArgumentParser()
p.add_argument('pngs', nargs='+'); p.add_argument('--sheet')
a = p.parse_args()
tiles = []
for f in a.pngs:
    im = Image.open(f).convert('RGBA'); m = np.asarray(im)[..., 3] > 128
    holes = ndimage.binary_fill_holes(m) & ~m
    lab, n = ndimage.label(holes)
    sizes = ndimage.sum(np.ones_like(m), lab, range(1, n + 1)) if n else np.array([])
    sizes = np.sort(sizes[sizes > 30]).astype(int)
    print(f'{os.path.basename(f):22s} subject {int(m.sum()):9d}  holes {len(sizes):3d}  ' + ' '.join(map(str, sizes[:15])))
    if a.sheet and len(sizes):
        bg = Image.new('RGBA', im.size, (25, 23, 22, 255)); bg.alpha_composite(im); r = np.asarray(bg.convert('RGB')).copy()
        r[ndimage.binary_dilation(holes, iterations=6) & ~ndimage.binary_dilation(holes, iterations=3)] = (255, 0, 0)
        t = Image.fromarray(r); tiles.append(t.resize((round(t.width * 400 / t.height), 400)))
if a.sheet and tiles:
    sheet = Image.new('RGB', (sum(t.width for t in tiles), 400)); x = 0
    for t in tiles: sheet.paste(t, (x, 0)); x += t.width
    sheet.save(a.sheet); print('sheet:', a.sheet)
