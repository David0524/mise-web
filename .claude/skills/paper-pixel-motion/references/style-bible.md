# Style bible — Paper / Pixel / Glow

A frame-by-frame breakdown of the style, from a 20.5 s, 1440×1080 (4:3), 23.976 fps reference piece.
Everything here is the *look and grammar*. Use your own words, your own objects and your own story.

---

## 1. The one-sentence idea

A spoken-word thought is set as small, quiet type on **grainy off-white paper**. It hard-cuts between
**three worlds** (paper, black void, saturated red) roughly every beat. Each world is populated by
**chunky pixel-art objects** that stand for the speaker's life, **glowing thermal silhouettes** of a body
(head, hand), and **hand-drawn ink marks** (scribbles, spray blots, loops) that feel like someone
is drawing on the film while it plays.

Three textures always fight in one frame: **clean vector type** vs **crunchy pixel sprites** vs
**soft analog glow/ink**. Never let one texture own the whole frame for long.

## 2. Format

| Property | Value |
|---|---|
| Aspect | **4:3** (1440×1080). Works at 1080×1350 or 1080×1920, but 4:3 is the signature |
| Frame rate | 23.976 / 24 fps. Animate on **ones** for type and camera, **twos or threes** for scribbles and ink (choppy, hand-made) |
| Length | 15–25 s. About 20 shots, so **average shot ≈ 1 s**. The longest holds are about 2 s |
| Audio | Soft voice-over with a music bed. Cuts land on syllables and beats, and the type appears **word by word in sync with the voice** |

## 3. Palette (sampled)

| Token | Hex | Use |
|---|---|---|
| `paper` | `#E1E3E2` (range `#D4D4D7`–`#E4E4E2`) | Main light background. Cool, slightly grey, never pure white |
| `paperShade` | `#9A9899` | Vignette corner value on paper |
| `ink` | `#322823` | Type on paper. A warm near-black, never `#000` |
| `void` | `#141414` (range `#131313`–`#171716`) | Dark background. Never pure black |
| `red` | `#D9201A` (glow core `#BB2016`, deep `#AE2515`) | The **only** accent. Sparkles, beams, music notes, glows, scribble loops, flash frames |
| `redDeep` | `#35171B` | Red bleeding into the void (sparkle halo, edge of a glow) |
| `cyan` | `#32B9E1` → `#2E5BFF` | Used **once**: the four-point light flare on the paper. Cyan bleeding into electric blue |
| `thermal` | `#FFF4D6` → `#FFB21E` → `#FF6A00` → `#E2261A` | Gradient map for silhouettes: hot white core, then yellow, orange, red at the edges |
| `white` | `#F2F0EC` | Type on void. Warm off-white |
| `yellowFlash` | `#E2B321` | One-frame colour flash card (ochre yellow) |
| `teal` | `#37C3C3` | Rare single-glyph accent (one letter tinted) |

Pixel sprites bring their own colours (green cash, gold coin, blue clapper, vinyl black) and these are the only other
hues allowed. **Rule:** paper scenes are monochrome plus sprites, void scenes are monochrome plus red plus sprites.

## 4. Film treatment (on every frame, every world)

1. **Grain.** Fine, monochrome, animated every frame, at about 6–9 % opacity on paper and 10–14 % on void. It is visible in flat areas.
2. **Vignette.** Strong on paper: the corners drop about 35 % toward `paperShade`, and the centre has a slight hot spot. Off-centre
   light pools also appear ("projector light"): an elliptical bright area that drifts across the frame.
3. **Flicker.** Global exposure jitters ±2–3 % per frame.
4. **Gate weave.** The whole frame drifts 0.5–1.5 px with slow noise.
5. **Softness.** Nothing is razor sharp. Type gets a 0.3–0.6 px blur and a tiny ink-spread halo. Pixel sprites stay crisp
   *inside* but get a slight bloom outside.
6. **Halation.** Bright things on void (white type, the thermal silhouette, red) get a soft glow of their own colour.
7. **Dust and specks.** 1–6 tiny dark specks per frame on paper (and light specks on void), at random positions, alive 1–3 frames.
   There are also little hairline slivers, 3–10 px long.
8. **Tone.** The blacks are lifted (`#141414`) and the whites are muted (`#E4E4E2`). Low contrast, like a scanned print.

## 5. Typography

- **Face:** a geometric sans with a **single-storey "a"**, round o, tight spacing. Medium or SemiBold.
  Bundled: **Outfit**. Near-equivalents: Poppins, Urbanist, Gilroy, Euclid Circular, Lexend.
- **Size contrast is the hook:**
  - *Hero word*: huge (font size about 32 % of the frame height, ≈350 px at 1080; glyphs ≈ 24 % tall), Bold, tight tracking (−4 %), with dashed horizontal guide lines
    at the baseline and the x-height or cap height, running edge to edge.
  - *Sentence*: small (**x-height** about 2.4 % of the frame height, i.e. a font size of about 52 px at 1080), Medium, **one line across the vertical centre**,
    left-aligned at about 4 % from the left edge. It can run nearly the full width.
  - *Card word*: medium (x-height about 3.7 % of H, a font size of about 80 px at 1080), Bold, white on void, with a trailing period ("word.") and
    a **thin vertical text-cursor bar** after it, separated by a gap of about 2.5 em.
  - *Spaced letters*: capitals (cap height about 4.4 % of H, a font size of about 64 px) spread across the frame with large gaps, one appearing per beat. The empty
    slots get filled by **objects** that act as letters.
- **Lower case** for all speech. Punctuation is minimal, apostrophes are optional, the period is kept. Capitals only for spaced letters.
- **Reveal grammar:**
  - **Word by word** in sync with the voice. The newest word arrives at about 60 % opacity / greyer and settles in 2–3 frames.
  - **Typewriter cursor**: a solid block (about 0.6 em wide) that sits ahead of the text, then shrinks to a thin bar and blinks
    (6 frames on, 6 off).
  - **Block wipe**: a solid black rectangle slides across, covering the next word, and then retracts to reveal it.
  - **Focus pull**: the sentence enters as a blurred, horizontally smeared bar (gaussian about 6 px plus horizontal motion blur)
    and snaps into focus over about 4 frames.
  - **Selection box**: a dotted rectangle with I-beam handles on its left and right ends (like a text-tool bounding box)
    is drawn around part of the sentence, as if someone is editing the video live.
  - **Emphasis**: one word in the sentence goes **white** (on a dark or red background) while the rest stays ink.

## 6. Mark-making layer (hand-drawn ink)

These sit on top of everything and are what makes the piece feel touched by a hand:

- **Scribble write-on.** A single continuous pen line (2–3 px, `ink`) draws itself: a loose cursive signature, a
  zig-zag, a tight spiral, a scrawled capital letter. It draws over 4–8 frames and is **animated on twos**. It often
  draws *under* a word like an underline or *around* it like a lasso.
- **Scribbled hero letter.** A huge letterform drawn as 5–15 overlapping jittery strokes (a sketch, not a font), with the "o"
  drawn as a tangle of circles. It appears for 2–4 frames and then resolves into the clean type.
- **Brush smear.** Large soft grey strokes that are motion-blurred, with a dark sharp core line (calligraphy brush, about 40 px).
  They sweep through the frame as a transition and are gone in about 6 frames.
- **Spray blot.** An airbrush-style black blob: a dense core with a speckled spray edge. It lands on an object, spreads,
  and the object turns into a **solid black silhouette** of itself.
- **Ink splatter hit.** A small radial burst of 6–10 short, sharp, tapered spikes in **ochre/yellow-orange**,
  for one or two frames, marking an impact.
- **Red loop scribbles.** Thin (1–1.5 px) red pen lines that make fast, large looping orbits around each letter, like
  a hand tracing over and over. They keep moving and redraw every 2 frames.
- **Speed streaks.** Thin horizontal red dashes (1–3 px tall, 50–300 px long) that cross the frame during a pan.

## 7. Pixel-art objects

- Large, chunky pixels (an apparent pixel of about 6–10 px at 1080p), a **1-px darker outline** in the object's shadow colour,
  2–3 tone shading, and a single highlight.
- **Personal-inventory set:** about 14 everyday objects that stand for one person (hobbies, possessions, feelings). The
  reference uses this kind of mix: camera, vinyl record, book, film clapper, houseplant, banknote stack, heart,
  coin, game controller, cap, skateboard, a black cat, music notes.
  **Pick your own subject's objects. Never copy a set, and never include real brand logos.**
- They are always flat 2D sprites but **move in 2.5D**: rotating in plane, tilting in Y (horizontal squash) to fake a turn,
  scaling up hugely past the camera.
- **Formations:**
  - **Ring / ellipse carousel**: all the objects overlap shoulder to shoulder around an ellipse (about 60 % × 50 % of the frame), slowly
    rotating. Objects at the "front" are larger (perspective scale 0.8–1.3).
  - **Conveyor**: a single horizontal row sliding left fast, with speed streaks, overlapping like a crowded shelf.
  - **Scatter**: objects floating at random spots, small (about 6 % of the frame), each with a slow independent rotation.
  - **Hero**: one object at about 25–35 % of the frame on the void, left of centre, next to a card word on the right.
  - **Letter slot**: an object takes the place of a letter in spaced type.
- **Behaviours:**
  - **Turn to silhouette**: an ink blot hits the object and it becomes flat black (keeping the outline), then the blots
    fly off.
  - **Fly-through**: the object scales from 1× to 4× in 6 frames while rotating 20–40°, with motion blur, and exits the frame.
  - **Gentle bob**: ±4 px sine at about 0.5 Hz plus ±3° rotation.

## 8. Light and glow

- **Four-point flare (sparkle).** An astroid (concave four-point star, `|x|^⅔ + |y|^⅔ = r^⅔`) with very long, thin
  points. Two flavours:
  - *Hard red*: a solid `red` astroid with a short glow, at the corner of an object (the "shine" on a camera body). It pops in at
    1.4× scale and settles to 1× in 3 frames, then turns 15°.
  - *Huge dithered*: one fills about ⅔ of the frame. Its fill is **stochastic dot dithering** (halftone noise), dark red
    on void, or cyan to blue on paper with a glowing rim. It sits behind everything. It rotates and scales slowly.
- **Thermal glow silhouette.** A body part (profile head, an open hand) as a flat silhouette filled with the
  **thermal gradient map** (hot white at the thickest or brightest area, through yellow and orange to red at the edges) plus
  a large outer glow. It looks like an infrared photo. On first appearance it comes in **blurred and red**, then
  sharpens and warms in about 6 frames.
- **Orbit ring.** A thin (2–3 px) off-white elliptical ring, tilted about 30°, that passes *through* the silhouette (the front
  half drawn over it, the back half hidden), sweeping 180° in about 12 frames. It is drawn with a trailing write-on, so it looks like a
  comet line.
- **Red radial glow.** A large soft red disc (radial gradient `#E52A1F` → transparent) behind an object on the void. It
  breathes in scale ±5 %.
- **Red light beam.** A thick, flat, hard-edged red parallelogram ray coming from off-frame to hit an object,
  with a slight outer glow. A second thinner ray mirrors it. They animate by extending along their axis.
- **Projector pool.** On paper, a big soft elliptical hot spot plus a dark falloff that drifts slowly. On the void, a warm
  brown bloom (`#3A2A2A`) washes in to open a transition.

## 9. Transitions (the edit is the style)

Hard cuts do most of the work. Each transition is 1–6 frames:

| Name | What happens | Frames |
|---|---|---|
| **Hard cut** | Straight cut on a word or beat. Often changes world (paper → void → red) | 0 |
| **Colour flash** | A full-frame flat colour card (yellow, red) with grain, for 1–3 frames, sometimes with one word on it | 1–3 |
| **Smear whip** | The incoming frame starts heavily directionally blurred (40–80 px) and resolves. Brush smears sweep across | 3–6 |
| **Block wipe** | A black bar slides across and takes the frame | 4–6 |
| **Exposure wash** | A warm grey or brown light leak washes over the void; the silhouette desaturates to a flat olive cut-out, then cuts | 4–8 |
| **Focus pull** | Starts out of focus (blur 10 px) and snaps in | 4 |
| **Silhouette dissolve** | The thermal silhouette blurs, turns red and dissolves into a red glow, which becomes the next scene | 4–6 |
| **Ink takeover** | A spray blot grows to cover an object, then the next cut | 3–5 |
| **Light-pool sweep** | A giant vignette shape slides over the scene, taking it into darkness | 6–10 |

## 10. Camera and motion feel

- There is little to no camera move. Motion comes from the **objects and the edit**.
- When the camera does move, it is a **fast push-in** (scale 1 → 1.15 in 12 frames, ease-out) or a **lateral slide** of the content.
- **Easing:** objects use a strong ease-out (`cubic-bezier(.16,1,.3,1)`) with a tiny overshoot. Scribbles are linear and
  choppy. Type is instant (no fade) or uses a 2-frame settle.
- **Motion blur** on anything fast: directional blur proportional to velocity, or 3–6 sub-frame accumulation.
- **Stepped animation:** scribbles, blots and red loops update every 2 frames (or 3). Everything else updates every frame. The mix of the two
  matters: the hand layer feels hand-made and the type feels digital.

## 11. Story structure (beat map of the reference)

Use this rhythm, not its content:

| t (s) | World | Beat archetype |
|---|---|---|
| 0.0–0.2 | Flash colour | **Cold open**: one hero word huge, a flat colour card plus dashed guide lines |
| 0.2–0.5 | Paper | Hero word as a scribble sketch, then clean, then a block wipe pushes it off |
| 0.5–2.0 | Paper | **The question**: a tiny sentence builds word by word along the centre line. Ink scribbles write under it. A focus pull. A selection box. Brush smears |
| 2.0–3.6 | Paper → darkening | **Flare**: a smear whip, then a huge cyan flare on the left, the sentence complete, small sprites floating. A light-pool sweep darkens the frame. One word turns white |
| 3.6–6.3 | Void | **The answer**: a glowing profile silhouette. A short answer phrase arrives word by word on the left. An orbit ring. Then an exposure wash to a flat olive cut-out |
| 6.3–8.3 | Paper | **Inventory**: the ring carousel of all the objects, rotating. Spray blots strike objects. A yellow splatter hit |
| 8.3–11.9 | Void ↔ paper alternating every ~0.5–0.8 s | **Value words**: a hero object plus "word." plus a cursor on the void, with a red sparkle, red beam, red notes. Between them, conveyor rows of objects on paper with speed streaks |
| 11.9–13.8 | Paper | **Breakdown**: the carousel breaks apart into a scatter. Blots turn objects into black silhouettes. Smears |
| 13.8–15.9 | Void | **Agency**: a glowing hand silhouette rising from the bottom. The phrase builds word by word on both sides of the hand. An exposure wash at the end |
| 15.9–17.2 | Paper / void / red cycling every 0.25 s | **Spelling**: spaced capital letters appear one per beat, with an object in each empty slot. The background colour changes on every letter |
| 17.2–20.5 | Paper | **Resolve**: brush smears, then the letters scatter rotated and floating, with red loop scribbles orbiting each one, then they converge into one tangled ink mark |

**Pattern rules:**
- Hold the wide, calm shots for 1.5–2 s, then accelerate into 0.25–0.5 s cuts before each section ends.
- Alternate worlds on every idea. Two consecutive shots in the same world must differ in scale (tiny type vs huge object).
- Each new section opens on a different texture than the one before it.
- The end is messier than the start (more ink, more hand) and dissolves into a mark rather than a clean logo.

## 12. Don'ts

- No pure `#000` or `#FFF`. No clean, ungrained frames.
- No drop shadows, no 3D renders, no gradients except the thermal map, glows and vignettes.
- No more than one accent colour family per section (red, or the single cyan flare moment).
- No real brand logos on sprites. No real person's likeness; silhouettes are generic or come from your own footage.
- No centred big paragraphs. Speech is one tiny line, or one word, or spaced letters.
- No easing on scribbles. No smooth 60 fps hand layer.
