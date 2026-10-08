# Motion craft: numbers that make it feel right

Lessons from studying a hand-tuned GPU build of this style (fframes, `examples/made-of-motion`, MIT). Only the
general craft is recorded here: timings, curves, palettes and layering rules. Never import another film's traced
artwork, footage, audio or cut list.

## Timing is in frames, not milliseconds

Think at 24 fps even when rendering at 60. Most moves finish in 2–5 frames; the eye reads that as a cut, not an
animation. A 700 ms ease-in-out is UI motion and kills the style.

| Moment | Frames @24 | Seconds | Curve |
|---|---|---|---|
| Card title snaps in from (+48, +18) px | 4 | .17 | `ease.snap` (cubic-bezier .12,.92,.2,1) |
| Red block cursor collapses to a bar (≈.68 → .07 of the type size) | 3 | .125 | ease out |
| Card subtitle rises 24 px, starting a frame after the title | 5 | .21 | `ease.expo` (.16,1,.3,1) |
| Card hold, total | ~20 | .83 | — |
| Caption builds a word at a time | 3 per word | .125 | hard cut per word |
| Ring object flies out to a card pose (lift arc ≈ sin(πp)·90 px) | 15 | .63 | `ease.std` (.42,0,.58,1) |
| …and back into its still-moving slot (dip ≈ −55 px) | 11–14 | .5 | `ease.std` |
| Ring explodes | 10 | .42 | `ease.expo`, then keep drifting and tumbling |
| Ink-nib impact: pull in, kick, spring back | 3 + 2 + ~12 | — | ease in-out, ease out, spring (k 190, c 14) |
| Heat flash on a struck object | 5 | .2 | linear decay from .83 |
| Soot stain after the flash | frames 3–23 | ~.9 | ramp up over 4, fade over 12 |
| Impact burst (stippled cloud + 7 rays) | 7 | .29 | `exp(-.42·frame)` |
| Spell letters | 6–10 each | .25–.4 | hard cuts |
| Thermal cut (hot band sweeping up into paper) | 4 | .17 | — |
| Brand: letters gather onto the word at 2.8× | 3 | .125 | ease in |
| …camera pulls back 2.8× → 1× | 4 | .17 | `ease.snap` |
| Tagline + dot fade in, rising 12 px | 6 | .25 | ease out |

Rules that fall out of this:
- **Keep momentum across cuts.** Objects that leave on one shot keep their velocity into the next; a hidden ring
  keeps rotating behind a card so the returning object lands in its real slot. Never rebuild a pose after a cut.
- **Exploding things don't tween to targets.** Burst on `ease.expo`, then let them drift (≈45 px/s along the
  burst direction) and tumble (spin rate grows with time and index).
- **Every hit is one event.** Nib, burst, kick, heat flash and soot are keyed to the same frame and object.

## Intro: the type does the work (frames at 24 fps)

| Frames | What happens |
|---|---|
| 0 | The first word, sketched by a pen (many jittered passes) on paper |
| 1 | Red frame; the word in black, stretched about 2.7× tall and cropped |
| 2 | Yellow card; the word with dashed guides top and bottom |
| 3 → | Oversized words (≈210 px) on two full-width dashed rulers (baseline, x-height). A new word every ~4 frames. The camera **jumps** to keep the newest word's right edge at ~80 %; for one frame the previous framing ghosts at ~40 % (crisp double exposure, never a smear). A black block fills the next word's slot 2 frames before it lands. A pen underlines the first two words and lassos the last |
| +1 | The line pixelates (one frame, ≈16 px cells) |
| +4 | Each word collapses to a broken dash (random segments) flying to its slot in the small sentence; the cursor becomes a vertical dotted bar |
| then | The small sentence sits in a dotted selection box with I-beam handles, blinking on frames 0, 1, 2, 4. Defocused handwriting ghosts behind, fading over ~14 frames, and a cursive pen line writes under it. Remaining words type every ~5 frames, the pen looping each new word (draw 3 frames, retract after 6) |

Pen marks are **cursive**, with loops at the top like a handwritten l or e and a slant (`scribblePath('cursive')`), never zigzags.

## Hand: a performance, not a still

The silhouette must feel filmed:
- **Entry (~10 frames):** it rises out of focus and **cold** (violet/magenta → red → orange as the heat comes up), with 2–3 white light-streak arcs swirling around it. Cut to it hard; never cross-fade from the previous shot.
- **Life:** the wrist sways (±2°, ~1.4 rad/s) about a pivot below the frame, the fingers flex (a horizontal strip warp that grows toward the fingertips), the hotspot drifts, and tiny white sparks flick off the fingertips every couple of frames.
- **Type beside it:** each next word is previewed by a white block the width of that word, which collapses to a thin bar within ~3 frames of the word landing.
- **Exit (~10 frames):** the background washes warm (maroon-grey), the body pales toward skin (exposure wash), and it whips out horizontally in the last ~3 frames.

## Thermal palette

A heat camera, not fire. The cold rim is **violet**, which makes it read as thermal imaging:

violet (.15,.025,.28) → crimson (.65,.016,.14) → red (.96,.075,.016) → orange (1,.51,.018) → amber (1,.83,.31) →
cream (1,.96,.80), each band a smoothstep window (.03–.24, .24–.45, .44–.72, .69–.88, .87–1). This is the engine
default (`PPM.HEAT_RAMP`; `ramp: 'v1'` restores the old red-edged ramp). The heat field climbs from ≈.1 at the
edge to 1 at the thickest point (power .62), plus a hotspot and slow noise. Add a faint warm halo outside the
body, and per-pixel grain on both body and background, or it looks like a gradient fill.

## Paper and film

- **Paper is a sheet, not a fill**: three octaves of value noise at ≈280, 81 and 14 px, ±9 levels on paper, ±2 on
  void. Static; it moves only with the camera (`g.bg` does this).
- **Grain refreshes at 24 fps** even in a 60 fps render. Never animate grain per output frame.
- **Dust**: ten motes drifting slowly (a few px/s), .32 opacity, 0.8–1.7 px. It's continuous, unlike specks,
  which pop per frame. Skip both on heat shots.
- **Vignette** is centred slightly up and left, and stronger on the darkest worlds.

## Pixel objects

- Project the sprite onto a plane in 3D (yaw, pitch, roll) and sample with nearest-neighbour. Shade the face by
  how much it faces the camera (.82 + .18·|n·z|). Antialias the plane's edges with 4 sub-samples, never by
  blurring texels.
- **Mosaic glitch**: drop an object to 4–10 cells across for a few frames and back (`block(…, { mosaic })`;
  flare `mosaic: true`). It works for waking, signal loss and memory.
- Heat on an object is a screen-blended orange flash, not a flat fill.

## Type

- One family, heavy for words and light for subtitles, with tight tracking (−1.25 px at 42–54 px).
- Subtitles are small, quiet and mono-like: ingredient lists, one-line facts. They are not sentences.
- Captions sit left-aligned at a fixed baseline; they never re-centre while building.
- The cursor is a design element: red, wide while arriving, a thin bar once the word has landed.

## Sound

The film is cut to the music; keep section boundaries on beats. Quiet films should sit near −20 LUFS integrated
with peaks under −4 dBFS, and the accents should be the loudest things in them.
