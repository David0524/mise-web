# Asking the user for ChatGPT image generations

The engine draws its own pixel sprites and silhouettes in code. That works well for simple objects. Ask the user to
generate images in ChatGPT when one of these is true:

| Need | Code is enough | Ask for a ChatGPT image |
|---|---|---|
| Pixel object, simple (heart, coin, note, star, mug) | ✅ `defSprite` | — |
| Pixel object with detail or character (a specific dog, a car model, a dish, a building, a person's favourite thing) | ❌ looks generic | ✅ pixel-art sprite prompt |
| A **set** of 8–16 personal objects with consistent style | Only if all are simple | ✅ one sprite-sheet prompt (consistency matters) |
| Thermal glow silhouette of a body part (profile, hand, full figure in a pose) | ⚠️ `PPM.SHAPES` is a stand-in for previews | ✅ **preferred for any hero silhouette.** A real mask (the user's photo, a CC0 cut-out, or a generated image) reads far more human: knuckles, nails, hair strands |
| The user's own likeness | ❌ | ✅ only from the user's own photo, which they supply |
| Paper or film textures | ✅ procedural | Rarely. Only for a specific scanned-paper look |

**Rule of thumb:** if the object is the *star* of a shot (hero card, letter slot) and it is not a simple geometric
icon, ask for an image. Background or scatter objects can stay procedural.

## How to ask

Ask once, batched, before building. Put every prompt in its own code block so the user can copy it in one tap.
Tell them the exact file names and where to drop the files. Use this template:

> For the best result I'd like a few images from ChatGPT (or any image model). For each one: open ChatGPT, paste the
> prompt, download the PNG, and put it in `<project>/assets/` with the file name shown. Ask ChatGPT for a
> **transparent background**. If it can't do that, ask for solid magenta `#FF00FF` and I'll key it out.
>
> **1. `sprite-sheet.png`: your objects**
> ```
> <prompt>
> ```
> **2. `hand.png`: thermal hand**
> ```
> <prompt>
> ```
> If you'd rather skip this, I'll draw everything in code. It works, just more generic.

Always offer the skip option. Never block the build waiting. Build with procedural stand-ins and swap them out when the images arrive.

## Prompt templates

Fill in the `{…}` slots. Keep the style clauses word for word; they are what makes the outputs match the engine.

### A. Pixel-art sprite sheet (consistent object set)
```
Pixel art sprite sheet of {N} separate objects, arranged in a {cols}×{rows} grid with generous empty space between
them: {object 1}, {object 2}, …, {object N}.
Style: chunky 32×32-pixel-era game sprites, each object about 32 pixels tall at native resolution, upscaled with hard
nearest-neighbour edges (no anti-aliasing, no blur). Every object has a 1-pixel dark outline, 2–3 flat shading tones
and one small highlight. Slight three-quarter angle, playful but grounded proportions. Saturated but not neon:
gold #E5B923, red #D61F1F, green #69BF4D, navy #283A8F, cream #ECEBE6, charcoal #2A2727.
No text, no logos, no brand marks, no drop shadows, no ground plane.
Fully transparent background (PNG). If transparency is unavailable: flat pure magenta #FF00FF background.
```

### B. Single hero sprite
```
A single pixel-art sprite of {object, with the specific details that make it theirs}, centred, filling about 70% of
the canvas. Chunky 32-pixel-tall native resolution, upscaled with crisp nearest-neighbour pixels, 1-pixel dark
outline, 2–3 flat shading tones, one highlight, slight three-quarter angle. No text, no logos, no shadow.
Transparent background PNG (or flat magenta #FF00FF), square 1024×1024.
```

### C. Thermal glow silhouette (body part or pose)
```
{A side-profile head and shoulders facing left | an open hand reaching up from the bottom of the frame with splayed
fingers | {pose}}, rendered as a thermal-camera / infrared glow: solid silhouette with no facial detail or texture,
filled with a smooth gradient map: hottest areas (the thickest parts) near-white cream #FFF4D6, then yellow #FFB21E,
orange #FF6A00, and deep red #E2261A at the very edges, with a soft warm bloom just outside the edge.
Pure flat black background #000000. No outlines, no background objects. Generic anonymous person, not a real
individual. 4:3 landscape, 1440×1080, subject {right-of-centre | centred, entering from the bottom edge}.
```
For the user's *own* likeness, they upload their own photo to ChatGPT with: *"Turn the person in this photo into …"* plus
prompt C from "rendered as a thermal-camera…".

### D. Flat cut-out silhouette (for the exposure-wash beat)
```
The same {pose} as a flat paper cut-out: a single solid olive-brown #6B5A2E shape with a slightly offset darker
copper #8A5A2E edge, like layered construction paper, on a flat black background. No texture, no detail.
```

### E. Scanned ink marks (optional extra hand-made texture)
```
A sheet of {8} isolated black ink marks on pure white paper, scanned: airbrush spray blots with a speckled edge,
fast calligraphy brush swooshes, tiny splatter flecks, a loose cursive scribble. High contrast, no text,
evenly spaced so each can be cut out.
```

## Bringing the images in

```js
// 1. Load the image (await it before window.ready = true).
const img = await loadImage('../assets/mug.png');
// 2. Optional magenta key-out happens in keyMagenta(img) → canvas (see below).
// 3. Register it. `pixel` re-pixelates smooth outputs into a chunky grid (6–10 is typical).
PPM.registerImageSprite('mug', keyMagenta(img), { pixel: 8 });
// 4. Use it like any built-in sprite: g.sprite('mug', x, y, size, {...})
```

Sprite sheet: slice it with `drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh)` into one canvas per cell, trim the
transparent margins, and register each one.

Thermal image: draw it full-frame with `ctx.globalCompositeOperation = 'screen'` on the void, and add the entry
effect yourself (start with `blur(28px) hue-rotate(-25deg) saturate(2)` and settle to `blur(1.5px)` over about 6 frames). For a
cut-out of the same pose, threshold the image's luminance into a mask.

```js
function loadImage(src) { return new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; }); }
function keyMagenta(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const [r, g, b] = [d.data[i], d.data[i + 1], d.data[i + 2]];
    if (r > 200 && b > 200 && g < 80) d.data[i + 3] = 0;
  }
  x.putImageData(d, 0, 0); return c;
}
```
