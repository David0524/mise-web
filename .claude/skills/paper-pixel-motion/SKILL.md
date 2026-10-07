---
name: paper-pixel-motion
description: Make short kinetic-typography films in the "paper / pixel / glow" style. Small word-by-word type on grainy off-white paper, hard cuts to a black void and saturated red, chunky pixel-art objects (carousels, conveyors, hero cards), thermal-glow silhouettes, hand-drawn ink scribbles, spray blots and red loops, four-point flares, film grain and vignette. Rendered deterministically from HTML canvas to MP4. Use when the user asks for a motion-graphics or kinetic-type video, a reel, an animated intro or manifesto in this lo-fi pixel / ink / glow style, or references this skill.
---

# Paper / Pixel / Glow motion films

This skill makes a 10–30 s kinetic-type film as an HTML canvas page, using a deterministic engine, and renders it
to MP4 with headless Chromium and ffmpeg. The film is the user's own words and objects in this visual language;
it is never a recreation of someone else's piece.

**Read first:** `references/style-bible.md`. It is the complete spec (palette, film treatment, type, ink layer,
pixel objects, light, transitions, motion, beat structure, don'ts). Every decision below defers to it.

## Files

| Path | What |
|---|---|
| `references/style-bible.md` | The style, measured frame by frame. **Read it every time.** |
| `references/recipes.md` | Copy-paste shot recipes for every beat archetype, with timings |
| `references/image-prompts.md` | When and how to ask the user for ChatGPT images, the prompt templates, and how to import them |
| `references/review-rubric.md` | The reviewer checklist used in the build loop |
| `engine/ppm.js` | Engine: `PPM.film`, shot timeline, drawing kit `g`, film post-processing |
| `engine/sprites.js` | Original procedural pixel sprites (`PPM.SPRITE_SET`) plus `PPM.defSprite` for new ones |
| `engine/fonts/` | Outfit 400–700 (OFL), the geometric single-storey-"a" face |
| `examples/test-segments.html` | A reference reel that uses every technique. Start new films from a copy of it |
| `tools/render.mjs` | `node render.mjs film.html outDir [--from --to --step --mp4 out.mp4 --audio a.mp3]` |
| `tools/contact-sheet.sh` | `contact-sheet.sh video.mp4 out.png [fps] [cols] [width]`: timestamped grid for review |

## Workflow

1. **Brief.** Get from the user: the message (one question → one answer → three values → one agency line → one
   final word is the native shape), the length (default 20 s), whether there is a voice-over or music file, and
   **10–16 personal objects** that stand for the subject. If they give only a topic, write the script yourself in
   the style: lower-case, short, conversational, one tiny line at a time.
2. **Beat sheet.** Map the script onto the beat structure in style-bible §11. Write a table:
   `t_start | dur | world | archetype | words + reveal times | objects | transition out`. Rules: average shot about 1 s,
   alternate worlds on every idea, accelerate cuts before each section ends, the end is messier than the start.
   If there is audio, get the onsets (`ffmpeg … astats` RMS per 0.1 s, or the user's timestamps) and snap word
   reveals and cuts to them.
3. **Assets decision.** Go through the objects and silhouettes against the table in `references/image-prompts.md`.
   If any would be clearly better as a generated image, **ask the user once** with ready-to-paste prompts and file
   names, and offer to skip. Keep building with procedural stand-ins meanwhile, and swap them when the files arrive.
4. **Build.** Copy `examples/test-segments.html` into the user's project (keep the relative `engine/` path, or copy
   `engine/` alongside it). Replace the shots using `references/recipes.md`. One `film.shot(dur, world, fn)` per cut.
   Keep each shot's code small; the kit does the heavy lifting.
5. **Render and review loop** (below) until every shot passes.
6. **Deliver.** Render the full MP4 (with audio if provided) plus a contact sheet. Report the file paths, the
   beat sheet and anything still procedural that would improve with generated images.

## Render and review loop (orchestrator + reviewer)

You orchestrate; a separate reviewer judges. Do not grade your own work.

```
loop:
  render  → node tools/render.mjs film.html out/ --mp4 out/film.mp4
  sheets  → tools/contact-sheet.sh out/film.mp4 out/sheet.png 4 6 320
            plus full-res stills of the key frames of every shot (ffmpeg -ss T -frames:v 1)
  review  → spawn a reviewer agent (Agent tool) with: the sheet and stills paths, references/style-bible.md,
            references/review-rubric.md, the beat sheet. It returns PASS/FAIL per shot with concrete fixes
            (numbers: px, frames, hex, opacity).
  fix     → apply every FAIL fix, re-render only the affected frame ranges (--from/--to), then re-review
            those shots.
until all shots PASS twice in a row (two consecutive reviewer passes with no FAIL)
```

When the user supplied a reference video in the same style, the reviewer also gets matching reference stills
to compare *technique* (texture, timing, scale, colour), never content. Keep the reference frames in the scratchpad,
never in the project.

## Engine cheatsheet

```js
const film = PPM.film(canvas, { w: 1440, h: 1080, fps: 24 });
film.shot(dur, 'paper' | 'void' | 'red' | 'yellow' | '#hex', (g, s) => { … }, { blur: s => px });
// s.t secs in shot, s.f frame in shot, s.p 0..1, s.F global frame, s.rnd seeded random
```
Kit `g` (all sizes in 1080p px; `g.U` scales):
- **type:** `text(str,x,y,{size,weight,color,align,track,blur,glow,alpha})`, `words(arr,times,t,x,y,{size,color,highlight:{i:col},settle})` → positions,
  `cursor(x,y,size,t,'block'|'bar')`, `guides([y…])`, `selectBox(x,y,w,h)`, `blockWipe(x,y,w,h,p0..2)`, `sketchText(str,x,y,size,F)`, `measure()`
- **ink:** `scribblePath(kind,x,y,w,h,seed)` (signature|zigzag|spiral|lasso|hook|underline), `stroke(pts,p,{width,color,p0,blur})`,
  `brushSmear(pts,p,{p0,width,core})`, `sprayBlot(x,y,r,grow,seed)`, `splatter(x,y,r,seed)`, `flecks(n,seed,f)`,
  `redLoops(x,y,r,f,seed,{loops})`, `streaks(n,seed,f)`
- **pixels:** `sprite(name,x,y,height,{rot,squash,silhouette,blur,flip,alpha})`, `carousel(names,cx,cy,rx,ry,rot,{size,per})`
- **light:** `sparkle(x,y,r,{rot,ax,ay,k,color})`, `ditherStar(x,y,rx,ry,rot,F,{colors,density,base,rim,k})`, `glow(x,y,r,color,a)`,
  `beam(x0,y0,ang,len,w0,w1,p,color)`, `lightPool(x,y,rx,ry,dark)`
- **bodies:** `thermal(shapeFn,{key,heat,blur,bias,frameKey})`, `cutout(shapeFn)`, `orbit(x,y,rx,ry,tilt,p,'back'|'front')`;
  shapes: `PPM.SHAPES.profile(cx,top,scale)`, `PPM.SHAPES.hand(cx,wristY,scale,spread)` or any `(ctx) => fill`
- **utility:** `layer({x,y,rot,scale,sx,sy,alpha,blur,blend},fn)`, `motionBlur(dx,dy,fn,n)`, `ease.*`, `stepped(f,2)`, `rng(seed)`, `noise1`

Film treatment (grain, vignette, flicker, gate weave, specks, halation) is applied automatically to every frame.
Turn pieces off with `PPM.film(canvas, { treatment: { weave: false } })`.

**Thermal caching:** `thermal()` caches by `key` + `frameKey`. A shape that moves needs a changing `frameKey`
(e.g. `Math.round(s.t*6)`, which also gives a nice on-sixes step). A static one needs none.

## Non-negotiables

- Everything comes from the user's script and objects. Never reuse another creator's script, object set or shot order.
- No real brand logos on sprites and no real person's likeness except the user's own, from their own photo.
- Every frame gets the film treatment. No pure black or white.
- Hand-made layers (scribbles, blots, loops) are stepped on twos. Type and objects run on ones.
- Speech is tiny, one line, word by word. Big type is reserved for the cold-open hero word.
- Red is the only accent, plus at most one cyan/blue flare moment.
