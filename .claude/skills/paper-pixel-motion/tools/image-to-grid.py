#!/usr/bin/env python3
"""Convert an upscaled pixel-art PNG (e.g. a ChatGPT sprite) into a PPM.defGrid() call.

  image-to-grid.py <sprite.png> <name> [--cell N] [--colors 12] [--key magenta|white|none] >> sprites.js

- Detects the art's pixel size (or use --cell), samples each cell's centre, and keys out transparent,
  magenta or white backgrounds (white only when connected to the image border, so white art survives).
- Quantises to at most --colors colours and emits rows + a palette, so the sprite renders with the
  engine's own block / morph / ink treatments exactly like hand-placed sprites.
Needs Pillow.
"""
import sys, collections
from PIL import Image

args = sys.argv[1:]
def opt(k, d):
    if k in args:
        i = args.index(k); v = args[i + 1]; del args[i:i + 2]; return v
    return d
cell = opt('--cell', None); ncol = int(opt('--colors', '12')); key = opt('--key', 'auto')
path, name = args[0], args[1]
im = Image.open(path).convert('RGBA'); W, H = im.size; px = im.load()

# ── background key ──
def is_bg_color(c):
    r, g, b, a = c
    if a < 40: return True
    if key in ('magenta', 'auto') and r > 200 and b > 200 and g < 80: return True
    return False
bg = [[False] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        bg[y][x] = is_bg_color(px[x, y])
if key == 'white':  # flood from the border through near-white pixels
    from collections import deque
    q = deque((x, y) for x in range(W) for y in (0, H - 1)) ; q.extend((x, y) for y in range(H) for x in (0, W - 1))
    seen = set()
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H): continue
        seen.add((x, y)); r, g, b, a = px[x, y]
        if a < 40 or (r > 240 and g > 240 and b > 240):
            bg[y][x] = True; q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

# ── bounding box of the art ──
xs = [x for y in range(H) for x in range(W) if not bg[y][x]]; ys = [y for y in range(H) for x in range(W) if not bg[y][x]]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)

# ── cell size: most common short run length of identical colour along rows/cols ──
if cell is None:
    # try cell sizes and keep the one whose cells are most uniform (pixel art is flat inside each cell);
    # the art's bounding box must also divide into ~whole cells
    import statistics
    def score(c):
        gw, gh = max(1, round((x1 - x0 + 1) / c)), max(1, round((y1 - y0 + 1) / c))
        cw, ch = (x1 - x0 + 1) / gw, (y1 - y0 + 1) / gh
        if abs(cw - c) > c * .08: return 1e9
        tot, n = 0, 0
        for j in range(0, gh, max(1, gh // 12)):
            for i in range(0, gw, max(1, gw // 12)):
                vals = [sum(px[int(x0 + (i + fx) * cw), int(y0 + (j + fy) * ch)][:3]) for fx in (.25, .5, .75) for fy in (.25, .5, .75)]
                tot += statistics.pstdev(vals); n += 1
        return tot / max(1, n) + 4 / c  # small bias toward bigger cells (fewer, cleaner pixels)
    cell = min(range(12, 64), key=score)
else:
    cell = int(cell)
gw = round((x1 - x0 + 1) / cell); gh = round((y1 - y0 + 1) / cell)
cw = (x1 - x0 + 1) / gw; ch = (y1 - y0 + 1) / gh

# ── sample cell centres ──
cells = []
for j in range(gh):
    row = []
    for i in range(gw):
        cx, cy = int(x0 + (i + .5) * cw), int(y0 + (j + .5) * ch)
        if bg[cy][cx]: row.append(None); continue
        # the cell's colour = the most common colour in its inner half (robust to anti-aliased edges)
        votes = collections.Counter()
        for fy in (.3, .4, .5, .6, .7):
            for fx in (.3, .4, .5, .6, .7):
                xx, yy = int(x0 + (i + fx) * cw), int(y0 + (j + fy) * ch)
                if not bg[yy][xx]: votes[tuple(v // 8 * 8 + 4 for v in px[xx, yy][:3])] += 1
        row.append(votes.most_common(1)[0][0])
    cells.append(row)

# ── palette: merge near-duplicate colours, keep distinct accents however small ──
flat = collections.Counter(c for r in cells for c in r if c)
pal = []
for c, n in flat.most_common():
    if not any(sum((a - b) ** 2 for a, b in zip(c, p)) < 30 ** 2 for p in pal): pal.append(c)
pal = pal[:max(ncol, 2)]
near = lambda c: min(range(len(pal)), key=lambda k: sum((a - b) ** 2 for a, b in zip(c, pal[k])))
chars = 'kabcdefghijlmnopqrstuvwxyzABCDEFGHIJ'
order = sorted(range(len(pal)), key=lambda k: sum(pal[k]))
cmap = {k: chars[i] for i, k in enumerate(order)}
rows = [''.join('.' if c is None else cmap[near(c)] for c in r) for r in cells]
palette = {cmap[k]: '#%02X%02X%02X' % pal[k] for k in order}
print(f"/* {name}: {gw}x{gh} cells from {path.split('/')[-1]} (cell {cell}px) */")
print(f"PPM.defGrid('{name}', [")
for r in rows: print(f"  '{r}',")
print("], " + "{ " + ", ".join(f"{k}: '{v}'" for k, v in palette.items()) + " });")
print(f"cell {cell}px → {gw}x{gh}", file=sys.stderr)
