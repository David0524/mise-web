# Film spec

A film is one JS file that sets `window.SPEC` (and optionally `window.SCENES`, custom draw functions). It loads
from `file://` with no fetch, through `examples/film.html?spec=<name>.film.js`.

```js
window.SPEC = {
  title: 'golden',
  size: [1440, 1080], fps: 25, duration: 48.4,
  base: '',                                // prefix for asset paths
  assets: { coors: 'cut/coors-young.png', bottle: 'cut/bottle.png' },   // name -> PNG made by tools/prep.py
  audio: 'out/mix.wav',                    // played in the browser preview; the render muxes it with --audio
  captions: LINES,                         // [[start, end, 'text' or 'line one\nline two'], ...] from tools/vo.py
  burns: [{ at: 45.16, dur: 0.08, color: 'rgba(190,40,30,.85)' }],
  treatment: { grain: 1, vignette: 1, flicker: 1, weave: 1, specks: 1, soft: 0.55 },
  segments: [
    { at: 0,    dur: 2.7,  scene: 'macroEdge' },          // a custom scene from SCENES (product shots)
    { at: 8.2,  dur: 25.2, kind: 'stack', plates: [...] }, // the litany
    { at: 33.4, dur: 11.9, scene: 'reveal' },
    { at: 45.3, dur: 3.1,  kind: 'black' },                // pure black; captions still draw
  ],
};
```

Units: x and y in **frame heights** from the frame centre (+y down; x spans about ±0.667 on 4:3). Sizes `h`
in frame heights. Times in seconds. Segments are hard cuts; nothing crosses a segment boundary.

## Captions

`captions` is `[[start, end, text]]`. `tools/vo.py` writes `lines.json` in exactly that shape from the VO it
synthesises, so captions, voice and plates share one clock. Split long lines with `\n` (at most about 26
characters per line). A caption is shown while `start <= t < end`; extend `end` to the next line's start when
the gap is under 0.6 s (`tools/check.mjs --fix-captions` does it).

## The stack (the litany)

```js
{ at: 8.2, dur: 25.2, kind: 'stack', drift: 0.028, nearBlur: 26, farBlur: 1.6, dim: 0.34, float: 0.004, pool: 0.05,
  plates: [
    { at: 8.2, pieces: [ { img: 'crowd', x: 0, y: 0.08, h: 0.9 } ] },
    { at: 10.4, k: 1.9, from: 'right', bg: [-0.3, -0.1], pos: [0, 0.04], enter: 0.5,
      pieces: [ { img: 'magician', x: 0.05, y: 0.1, h: 0.95 },
                { img: 'rabbit', x: -0.3, y: -0.05, h: 0.35, rot: [[0, -8], [1.2, 6]] } ] },
    { at: 23.4, k: 6.5, from: 'camera', hole: [0.12, -0.05, 0.11, 0.11], bg: [0.12, -0.05],
      pieces: [ { img: 'binoculars', x: 0, y: 0.05, h: 1.1 } ] },
  ] }
```

Plate fields:

| field | default | meaning |
|---|---|---|
| `at` | — | time the plate starts entering (put it on the first word of its VO line, or 0.1 s before) |
| `pieces` | — | cut-outs in plate coordinates (below) |
| `k` | 1.9 | how much the previous plate shrinks when this one settles (1.6–2.4 normal; 4–8 for a portal) |
| `bg` | [-0.3, -0.06] | where the previous plate's centre ends up on screen once this plate has settled |
| `pos` | [0, 0.04] | where this plate's centre sits on screen once settled |
| `from` | 'right' | entry side: right, left, bottom, top, bottom-right, bottom-left, camera, or a vector [dx, dy] |
| `fromDist` | 0.95 | how far off its settled place it starts, in H |
| `fromScale` | 1.25 | extra scale at the start of the entry (on top of `k`) |
| `enter` | 0.5 | entry length in seconds (0.4–0.6: 10–15 frames at 25 fps) |
| `ease` / `entryEase` | lurch / out | camera ease and the plate's own slide ease |
| `hole` | — | `[x, y, rx, ry, rotDeg]` in plate coordinates: a portal. Every older plate is drawn only inside it. Set `bg` to the hole's centre so the old scene sits in it |
| `keep` | 2.9 | how many steps back the plate stays visible before it fades out |
| `nearBlur` | stack's | blur in px (at 1080) at one step in front of focus |
| `draw` | — | name of a SCENES function called after the pieces (for a hand-drawn extra) |

Stack fields: `drift` (slow zoom-out per second while a line plays), `nearBlur`, `farBlur`, `dim` (brightness
lost per step back), `float` (handheld drift in H), `pool` (background light pool), `void`.

Piece fields: `img`, `x`, `y`, `h`, `rot` (deg), `flip`. Any of `x`, `y`, `h`, `rot` can be keyframes
`[[t, v], [t, v, 'ease']]` with `t` relative to the plate's `at`. Hinged parts:

```js
{ img: 'baby', x: 0, y: 0.1, h: 0.9,
  parts: [ { poly: [[812, 300], [1100, 260], [1150, 520], [820, 560]], pivot: [830, 430], rot: [[0, 0], [0.4, -25], [0.8, 0]] } ] }
```

`poly` and `pivot` are in the cut-out PNG's pixels. The part is cut out of the base and rotated about the
pivot. Use it for a waving arm, a nodding head, a prop swinging on a hand.

### How the camera is solved

Each plate j has a world scale `W_j = k_1 × … × k_j` and a world centre chosen so that, when the camera has
settled on j, plate j's centre is at `pos_j` and plate j-1's centre at `bg_j`. The camera zoom moves
exponentially between settled states (so the pull-back has constant perceived speed) while the old plate's
screen position glides linearly from `pos` to `bg`. Between transitions the camera keeps zooming out by
`drift`. A plate's depth is `u - j`, where `u` is the continuous plate index: depth < 0 is in front of focus
(blurred by `nearBlur` per step), depth > 0 is behind (dimmed by `dim` per step, blurred by `farBlur`).

## Scenes (product shots and anything custom)

```js
window.SCENES = {
  macroEdge(g, s) {            // s.t secs into the segment, s.p 0..1, s.f global frame, s.T global time
    g.background('#141211', 0);
    g.image('bottle', 0.02, 0.35 - s.t * 0.01, 1.6, { bright: 0.5 });
    g.sweep('bottle', 0.02, 0.35 - s.t * 0.01, 1.6, s.p);
  },
};
```

Kit `g` (all in H units): `background(color, pool, px, py)`, `image(name, x, y, h, {rot, flip, blur, bright,
contrast, alpha, ax, ay})`, `pool(x, y, rx, ry, color, alpha, rot, soft)` (a spotlight pool), `curtain(t,
{x0, x1, top, bottom, light, amt})` (the reveal's backlit folds), `reflect(name, x, floorY, h, o)`,
`sweep(name, x, y, h, p, {amt, rot})` (a light band across a cut-out), `title(lines, x, y, {reveal, bevel,
glow})` with `lines: [{text, size, gap, dx, font}]`, `script(text, x, y, size, {rot, chars, alpha})`,
`dust(f, n)`, plus `ctx`, `W`, `H`, `sx(x)`, `sy(y)`, `px(v)`, `kf`, `ease`, `lerp`, `clamp`, `rng`.

The film treatment (grain, vignette, flicker, weave, softness, specks, burns) is applied to every segment
except `black`. Captions draw last, on top of everything.
