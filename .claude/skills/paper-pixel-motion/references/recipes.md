# Shot recipes

Every recipe is one `film.shot(...)` call. `examples/test-segments.html` contains working versions of all of them;
copy from there and change the words, objects and timings. Durations are in frames at 24 fps (`n/24`).

| # | Archetype | World | Frames | Key calls |
|---|---|---|---|---|
| 1 | **Flash-card hero word** | yellow / red | 3–5 | `text(size≈350, weight 700, track −.04, align center)` + `guides([y1,y2])` |
| 2 | **Sketch → clean hero, block wipe** | paper | 6–10 | `sketchText` for 2–3 frames → `text` + `guides` + under-`stroke` + `blockWipe` |
| 3 | **Focus pull** | paper | 4–6 | `layer({blur: (1-ease.out(p))*9})` around `words` |
| 4 | **Selection box edit** | paper | 5–8 | `words` + `selectBox` + `scribblePath('signature')` + `brushSmear` |
| 5 | **Sentence build** | paper | 18–30 | `words(arr, times)` at y=540, x≈40, size ≈52; one `scribblePath` writing under the newest word, cycling kinds |
| 6 | **Smear whip** | paper | 3–5 | `layer({blur:7})` + `motionBlur(140,40, …)` of the next shot's content + a few long smear bars |
| 7 | **Flare + floaters + light pool** | paper | 30–40 | `ditherStar(-40,540,520,720, … colors:[blue,cyan], rim)` + small bobbing sprites + `lightPool` closing in + `words(…, {highlight})` |
| 8 | **Red glow dissolve** | void | 4–6 | `glow` + dark-red `ditherStar` behind the sentence (one word white) |
| 9 | **Thermal profile answer** | void | 40–60 | `orbit(…,'back')` → `thermal(SHAPES.profile)` → `orbit(…,'front')`; white `words` on the left; wash overlay + `cutout` at the end |
| 10 | **Inventory carousel + blot strikes** | paper | 36–50 | `carousel(set, 720,540, 470,300, t*.35, {per: silhouette when hit})`; per hit: `brushSmear` in → `sprayBlot` → `splatter` |
| 11 | **Value card** | void | 14–22 | dark dither star fading, blurred-in hero `sprite` (≈380 px) at x≈400, `sparkle` at its top-right corner, `text('word.', size 80)` at x≈820 + `cursor` (block → bar), optional fly-through at the end |
| 12 | **Conveyor** | paper | 6–12 | row of sprites at y=540, about 230 px apart, moving 1400 px/s, `motionBlur(-26,0)` + `streaks` |
| 13 | **Beam card** | void | 14–18 | value card + two `beam`s extending from behind the object |
| 14 | **Notes / scribble card** | void | 16–22 | value card + white `stroke` zig-zag hit in the first 4 frames + bobbing `note` sprites popping in |
| 15 | **Carousel breakdown** | paper | 36–48 | lerp carousel positions → random scatter, shrinking; `sprayBlot` → `silhouette:1` on every third item; `brushSmear` sweep; static blots |
| 16 | **Thermal hand agency line** | void | 40–50 | `thermal(SHAPES.hand(…, spread), {frameKey})` rising, `words` split left and right of the hand, falling white specks, wash out |
| 17 | **Spaced letters / world cycle** | paper → void → red → void | 5–7 each | one shot per letter; letters at x = 90 + 380·i; a `sprite` in the next slot; `glow` behind on void; one letter teal |
| 18 | **Ink resolve** | paper | 60–80 | 3 `brushSmear`s, then rotated letters drifting and settling, `redLoops` on each, then converge to centre and scale up, ending in a thick tangled `stroke` |

## Timing patterns

- **Word reveal:** 0.10–0.14 s per word for fast speech. With audio, use onsets.
- **Card:** object blurs in over 0.2 s (blur 10→0, `ease.out`), the sparkle pops with `ease.back` over 0.2 s, the word
  appears with a white block flash for 2 frames, and the cursor starts as a block then becomes a blinking bar at 4 Hz.
- **Blot strike:** a smear comes in over 4 frames → the blot grows over 4 frames → the splatter shows for 2 frames →
  the object becomes a silhouette.
- **Exposure wash:** warm grey `rgba(110,92,92,.75)` ramps over 8 frames, then switch to `cutout`, then hard cut.
- **Section end acceleration:** shots 24 → 16 → 10 → 6 frames.

## Composition grid (1440×1080)

- Sentence line: y = 540, x starts at 40 (≈ 3 %).
- Card: object centre x ≈ 400 (height ≈ 380), word starts x ≈ 820 (size 80), cursor ≈ word end + 90.
- Silhouette subject: right of centre (x ≈ 1000) with text on the left (x ≈ 130), or centre-bottom with text split
  either side at x ≈ 420 and x ≈ 930.
- Carousel: centre (720,540), radii 400 × 260, sprite height ≈ 250 (items overlap shoulder to shoulder).
- Spaced letters: x = 90, 470, 850, 1230 at y = 540, size 64. Slot objects (≈280 px) sit midway between letters, never past the last one.
