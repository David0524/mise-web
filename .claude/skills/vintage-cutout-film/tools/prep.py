#!/usr/bin/env python3
"""Turn a period photograph into a graded, scissor-cut paper cut-out (RGBA PNG).

  python3 prep.py in.jpg out.png [--crop x,y,w,h] [--model u2net] [--rim 5] [--max 1800]
                  [--mask mask.png] [--keep-bg] [--hole cx,cy,rx,ry] [--contrast 1.0] [--gamma 1.0]

Steps: crop -> background removal (rembg) or a supplied mask -> luminance -> auto levels -> sepia map ->
alpha cleaned and rounded like a scissor cut -> a paper rim a few px outside the silhouette -> optional
hole (a portal: binocular lens, open mouth) punched as transparent.

--crop is in source pixels and applied first. --mask is a white-on-black PNG the size of the crop (or of the
source if there is no crop), for subjects rembg gets wrong. --keep-bg keeps the whole rectangle with no rim (a backdrop),
still graded; --card keeps the whole photo as a print with the scissor-cut paper rim (landscapes, interiors). --rim is the paper rim width in output px (default: 0.28 % of the long side). Prints a JSON line with the output
size, the subject's bounding box and the hole in output px; the film uses it.

Models (rembg): u2net (general), u2net_human_seg (people), isnet-general-use (objects, crisp edges).
"""
import argparse, json, sys
import numpy as np
from PIL import Image, ImageFilter, ImageOps

# luminance -> RGB, measured from the reference grade
SEPIA_X = [0.00, 0.18, 0.50, 0.80, 1.00]
SEPIA_RGB = [(24, 21, 18), (52, 45, 40), (138, 124, 112), (212, 196, 180), (246, 230, 212)]
RIM = (233, 221, 203)


def sepia(lum):
    out = np.zeros(lum.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(lum, SEPIA_X, [v[c] for v in SEPIA_RGB])
    return out


def grade(rgb, alpha, contrast, gamma):
    lum = (rgb[..., 0] * .299 + rgb[..., 1] * .587 + rgb[..., 2] * .114) / 255
    sel = lum[alpha > .5] if (alpha > .5).sum() > 500 else lum.ravel()
    lo, hi = np.percentile(sel, 1), np.percentile(sel, 99.6)
    lum = np.clip((lum - lo) / max(hi - lo, 1e-3), 0, 1)
    lum = np.clip(.5 + (lum - .5) * contrast, 0, 1) ** gamma
    # gentle highlight roll-off, as in a print
    lum = np.where(lum > .8, .8 + (lum - .8) * .75, lum) / .95
    return sepia(np.clip(lum, 0, 1))


def scissor(alpha, rim, seed=7):
    """Round the silhouette like a scissor cut and grow it by `rim` px with a slightly irregular edge."""
    a = Image.fromarray((alpha * 255).astype(np.uint8))
    a = a.filter(ImageFilter.GaussianBlur(max(1.5, rim * .5)))
    core = (np.asarray(a) > 128).astype(np.float32)
    grown = Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * rim + 1))
    g = np.asarray(grown.filter(ImageFilter.GaussianBlur(rim * .8))).astype(np.float32) / 255
    rng = np.random.default_rng(seed)
    h, w = g.shape
    noise = np.asarray(Image.fromarray((rng.random((max(2, h // 40), max(2, w // 40))) * 255).astype(np.uint8))
                       .resize((w, h), Image.BICUBIC)).astype(np.float32) / 255
    edge = np.clip((g - .5 + (noise - .5) * .25) * 6 + .5, 0, 1)
    edge = np.asarray(Image.fromarray((edge * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.8))).astype(np.float32) / 255
    inner = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7))).astype(np.float32) / 255
    return edge, np.minimum(inner, edge)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('src'); p.add_argument('out')
    p.add_argument('--crop'); p.add_argument('--model', default='u2net'); p.add_argument('--mask')
    p.add_argument('--rim', type=int, default=0); p.add_argument('--max', type=int, default=1800)
    p.add_argument('--keep-bg', action='store_true'); p.add_argument('--card', action='store_true'); p.add_argument('--hole')
    p.add_argument('--contrast', type=float, default=1.0); p.add_argument('--gamma', type=float, default=1.0)
    p.add_argument('--flip', action='store_true'); p.add_argument('--no-rim', action='store_true')
    p.add_argument('--erase', action='append', default=[], help='x1,y1,x2,y2,...: a polygon in output-PNG pixels (before padding) to cut away from the mask, e.g. a cast shadow; repeatable')
    p.add_argument('--fill-holes', type=float, default=0, help='fill enclosed holes smaller than this fraction of the subject (e.g. .03): gaps between arms that would get a stray inner rim')
    p.add_argument('--sky', type=float, help='landscape: cut away bright sky above the skyline (luminance threshold 0..1, e.g. .78)')
    a = p.parse_args()

    im = ImageOps.exif_transpose(Image.open(a.src)).convert('RGB')
    if a.crop:
        x, y, w, h = map(int, a.crop.split(',')); im = im.crop((x, y, x + w, y + h))
    if a.flip: im = ImageOps.mirror(im)
    k = min(1.0, a.max / max(im.size)); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)

    if not a.rim: a.rim = max(4, round(max(im.size) * .005))  # about 4-5 px on screen once the figure fills 0.8 H
    if a.sky is not None:
        # cut along the skyline: per column, sky is the bright run from the top down to the first darker pixel
        lum = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
        lo, hi = np.percentile(lum, 2), np.percentile(lum, 99.5); lum = (lum - lo) / max(hi - lo, 1e-3)
        dark = lum < a.sky
        first = np.where(dark.any(0), dark.argmax(0), im.height)
        k5 = max(3, im.width // 150) | 1
        first = np.convolve(np.pad(first, k5 // 2, mode='edge'), np.ones(k5) / k5, 'valid')
        alpha = (np.arange(im.height)[:, None] >= first[None, :] - 1).astype(np.float32)
    elif a.keep_bg or a.card:
        alpha = np.ones((im.height, im.width), np.float32)
    elif a.mask:
        m = Image.open(a.mask).convert('L')
        if a.flip: m = ImageOps.mirror(m)
        alpha = np.asarray(m.resize(im.size, Image.LANCZOS)).astype(np.float32) / 255
    else:
        from rembg import remove, new_session
        cut = remove(im, session=new_session(a.model), post_process_mask=True)
        alpha = np.asarray(cut)[..., 3].astype(np.float32) / 255

    if not (a.keep_bg or a.card) and a.sky is None:
        # drop mask islands (stray fragments that would each get their own rim): keep components >= 0.5 % of the subject
        from scipy import ndimage
        lab, n = ndimage.label(alpha > .5)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
            keep = np.isin(lab, 1 + np.where(sizes >= max(sizes.max() * .005, 50))[0])
            alpha = alpha * ndimage.binary_dilation(keep, iterations=2)
    if a.erase:
        from PIL import ImageDraw
        m = Image.new('L', (alpha.shape[1], alpha.shape[0]), 255); d = ImageDraw.Draw(m)
        for poly in a.erase:
            v = [float(t) for t in poly.split(',')]; d.polygon(list(zip(v[0::2], v[1::2])), fill=0)
        alpha = alpha * (np.asarray(m).astype(np.float32) / 255)
        # what an erase leaves behind (slivers, thin strips) goes too: opening + keep components >= 0.5 %
        from scipy import ndimage
        solid = ndimage.binary_opening(alpha > .5, iterations=4)
        lab, n = ndimage.label(solid)
        if n:
            sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
            keep = np.isin(lab, 1 + np.where(sizes >= sizes.max() * .005)[0])
            alpha = alpha * ndimage.binary_dilation(keep, iterations=4)
    if a.fill_holes > 0:
        from scipy import ndimage
        solid = alpha > .5; holes = ndimage.binary_fill_holes(solid) & ~solid
        lab, n = ndimage.label(holes)
        if n:
            sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, n + 1))
            small = np.isin(lab, 1 + np.where(sizes < a.fill_holes * solid.sum())[0])
            alpha = np.maximum(alpha, small.astype(np.float32))
    pad = 0 if a.keep_bg else a.rim * 3  # a card keeps the whole photo and gets the rim around its edge
    rgb = np.asarray(im).astype(np.float32)
    if pad:
        rgb = np.pad(rgb, ((pad, pad), (pad, pad), (0, 0)), mode='edge'); alpha = np.pad(alpha, pad)
    graded = grade(rgb, alpha, a.contrast, a.gamma)
    if a.keep_bg:
        outer, inner = alpha, alpha
    elif a.no_rim:
        inner = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))).astype(np.float32) / 255; outer = inner
    else:
        outer, inner = scissor(alpha, a.rim)
    col = graded * inner[..., None] + np.array(RIM, np.float32) * (1 - inner[..., None])
    out_a = outer.copy()
    hole = None
    if a.hole:
        cx, cy, rx, ry = map(float, a.hole.split(','))   # in output px of the cropped, scaled image (before padding)
        cx, cy = cx * k + pad, cy * k + pad
        rx, ry = rx * k, ry * k
        yy, xx = np.mgrid[0:out_a.shape[0], 0:out_a.shape[1]]
        d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        out_a = out_a * np.clip((d - 1) * 40, 0, 1)
        hole = [round(cx), round(cy), round(rx), round(ry)]
    rgba = np.dstack([np.clip(col, 0, 255), np.clip(out_a * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(a.out, optimize=True)
    ys, xs = np.where(out_a > .5)
    bbox = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)] if len(xs) else None
    print(json.dumps({'out': a.out, 'w': rgba.shape[1], 'h': rgba.shape[0], 'bbox': bbox, 'hole': hole}))


if __name__ == '__main__':
    sys.exit(main())
