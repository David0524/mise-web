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
| `references/writing.md` | **Writing engine**: thesis → shape → word budget → voice rules → objects → beats → lint |
| `references/spec.md` | Film spec format: beat types, fields, timing rules |
| `engine/plan.js` | Planner: aligns beats to word timings or estimates them, assigns worlds, accelerates section ends, picks transitions, lints |
| `engine/compose.js` | Composer: one builder per beat type (cut and flow), so a film renders straight from its spec |
| `tools/plan.mjs` | `node plan.mjs film.film.js [words.json] [--md out.md]`: beat sheet, warnings and errors without rendering |
| `examples/sauce.film.js` + `examples/compose.html` | A complete spec-driven film (original, shape "steps") |
| `references/recipes.md` | Copy-paste shot recipes for every beat archetype, with timings |
| `references/image-prompts.md` | When and how to ask the user for ChatGPT images, the prompt templates, and how to import them |
| `references/review-rubric.md` | The reviewer checklist used in the build loop |
| `engine/ppm.js` | Engine: `PPM.film`, shot timeline, drawing kit `g`, film post-processing |
| `engine/sprites.js` | Original procedural pixel sprites (`PPM.SPRITE_SET`) plus `PPM.defSprite` for new ones |
| `engine/fonts/` | Outfit 400–700 (OFL), the geometric single-storey-"a" face |
| `examples/test-segments.html` | A reference reel that uses every technique. Start new films from a copy of it |
| `tools/render.mjs` | `node render.mjs film.html outDir [--from --to --step --mp4 out.mp4 --audio a.mp3]` |
| `tools/contact-sheet.sh` | `contact-sheet.sh video.mp4 out.png [fps] [cols] [width]`: timestamped grid for review |

## Two modes

| | **cut** (as measured in the style bible) | **flow** (continuous) |
|---|---|---|
| Edit | Hard cuts on beats, 1–3-frame flash cards, whips | Every handoff starts on the exact last frame of the shot before (`g.under`); hard cuts only on final beat flips |
| Motion | Pops, overshoot, ink and scribbles on twos | Eased glides of about 0.5 s with a soft start (`ease.inOut`); nothing pops |
| Frame rate | 24 fps | 60 fps with `subframes: 8` (true motion blur) |
| Camera | Static, with an occasional push | `camera: { float: 7, rot: .35, push: .04 }`: handheld float plus a slow push per shot |
| Sprites | Flat (`g.sprite`) | 3D blocks (`g.block`): extrusion, bevel, contact shadow |
| Silhouettes | `g.thermal` (blur-based) | `g.heat` (distance transform + hotspot + noise, razor edge) |
| Type | Word-by-word fades | Typed behind a block cursor (`g.caption` + `g.typedFromWords`) |
| Example | `examples/test-segments.html` | `examples/flow-reel.html` (technique sampler) |

Ask which mode the user wants if they haven't said. Default to **cut** for a raw, zine-like feel and **flow**
for a polished, continuous one. Elements can be mixed.

## Workflow

The film is **data**: write a spec, let the planner time and lint it, and let the composer render it. Hand-written
shots are only for moments the beat types don't cover.

1. **Intake. Ask for everything in one message:**
   - the voice-over or song with a spoken line (audio file) plus its transcript, or just a topic and you write the script;
   - **10–12 small objects** that sum up the subject (their life, product or brand world);
   - the silhouettes to light like a heat camera (e.g. a head in profile, a raised hand), as photos or PNGs with the body in alpha.
     Real masks beat the built-in `PPM.SHAPES` every time; treat those as preview stand-ins and offer the image prompts;
   - the **3 words** that should land hardest;
   - the mode (cut / flow), the aspect ratio (default 4:3 at 1440×1080) and the length (default 20 s).
   If they skip something, derive it from **their topic** and say what you chose. The built-in sets
   (`PPM.KITCHEN_SET`, `PPM.SPRITE_SET`) are demo placeholders.
2. **Write.** Follow `references/writing.md`: thesis → shape → word budget → lines → objects → beats. Output a
   spec file `<name>.film.js` (`references/spec.md`) in the user's project.
3. **Time it.** With audio: `python3 tools/word-timings.py voice.mp3 words.json --transcript "…"`, then wrap it as
   `window.WORDS = …` in `words.js`. Without audio, the planner estimates timing.
4. **Plan and lint.** Run `node tools/plan.mjs <name>.film.js [words.json]` and fix every error and warning that applies.
   Show the user the **thesis, the script and the beat sheet** and get a yes before rendering.
5. **Assets.** Check the objects and silhouettes against `references/image-prompts.md`. Ask once for any
   generated images (with ready-to-paste prompts), and keep going with stand-ins meanwhile. Unusual objects get new
   `PPM.defGrid` sprites.
6. **Compose.** Copy `examples/compose.html` next to the spec (fix the relative `engine/` paths) and open it with
   `?spec=<name>.film.js&words=words.js`. Adjust through the spec (beat fields) first; only add hand-written
   `film.shot()`s for one-offs.
7. **Show 8 stills before the full render** (`render.mjs compose.html stills/ --times …`, one per section).
8. **Render and review loop** (below) until every shot passes.
9. **Deliver.** Render the full MP4 (flow mode: `--query fps=60 --subframes 8`), lay the original audio back on
   (`--audio`), and produce a contact sheet plus the final beat sheet (`plan.mjs --md`).

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

## Flow kit (engine/flow.js + engine/grid-sprites.js)

- **sprites:** `PPM.defGrid(name, rows16, palette)` for hand-placed 16×16 cells; `block(name,x,y,size,{rot,flipX,lift,ink,shadow})`;
  `ring(names,cx,cy,R,{tilt,spin,t,bob,size,per})` (a perspective ring: front items bigger, lower, drawn last); `ringFrontLeft(n, spin)`
- **heat:** `heat(shapeFnOrMask,{key,t,heat,hotspot:[x,y,r,ry?],noise,glow,offset,scale,thick})`, `maskOf(key)`;
  `PPM.loadMask(url,{luma,invert})` → `PPM.placeMask(mask,{x,y,h,flip})`
- **type:** `typed(str,t0,cps,t)`, `typedFromWords(words,t)`, `caption(shown,x,y,{align:'center',size,color,cursor,blink})`, `underline(x,y,w,p)`
- **transitions:** `flood(x,y,p,color)` + `inFlood(x,y,p,fn)`, `burn(x,y,p,{toR,edge})`, `fallThrough(mask,px,py,p,innerFn,{k,innerK})`,
  `under(shotIndex,t)`, `morph(a,b,p,x,y,size)`, `sparks(x,y,p)`
- **film opts:** `fps`, `subframes`, `camera:{float,rot,push}`, per-shot `{push}`, `font:'Geist'`

## Gotchas

- A mask PNG with no alpha fills the whole box with heat. Put the silhouette in alpha, or load it with `PPM.loadMask(url, {luma:true})`.
- A limb cut by the photo's border shows a straight edge. Place the mask so it runs past the frame; the distance
  transform ignores out-of-frame neighbours, so the cut does not read as an edge.
- A handoff only reads as smooth when the last frame of one shot equals the first frame of the next. Draw the
  outgoing shot underneath (`g.under(i-1, dur-ε)`), and give every shot that shows the same formation one shared
  zoom or position function of global time `s.T`.
- A flood that is still retreating when the next shot starts reads as a hard cut. Let it finish inside the shot.
- A fast ease-out flood reads as a jump. Use `ease.inOut` (soft start).
- `thermal()`/`heat()` cache by `key`. Use a new key for each different shape.
- Subframes multiply render time by N. Preview at `subframes: 1` and do the final render only at 8.

## Non-negotiables

- Everything comes from the user's script and objects. Never reuse another creator's script, object set or shot order.
- No real brand logos on sprites and no real person's likeness except the user's own, from their own photo.
- Every frame gets the film treatment. No pure black or white.
- Hand-made layers (scribbles, blots, loops) are stepped on twos. Type and objects run on ones.
- Speech is tiny, one line, word by word. Big type is reserved for the cold-open hero word.
- Red is the only accent, plus at most one cyan/blue flare moment.
