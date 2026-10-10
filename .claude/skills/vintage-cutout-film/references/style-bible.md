# Style bible: vintage cutout film

Measured from a 48.4 s, 960×720 (4:3), 25 fps reference (a mock perfume ad). This page records the **look
and grammar** only. Write your own script, choose your own photos and build your own story.

## 1. The idea in one sentence

Old black-and-white photographs, cut out with scissors, hang in a dark void. A camera keeps **pulling back
through them**: every new line of voice-over brings a new cut-out figure in from right in front of the lens,
and the figure before it sinks into the dark behind. It opens and closes like a luxury commercial: a lit
product, a whispered line, and a title. Then comes a deadpan last line on black.

The comedy and the charm come from the contrast between the sincere, breathy ad voice and the cheap,
charming, visibly scissor-cut collage.

## 2. Format

| Property | Value |
|---|---|
| Aspect | 4:3. Render 1440×1080 (the reference is 960×720) |
| Frame rate | 25 fps, animated **on ones**: no stepped or held animation in the collage. 10 % of frames are near-frozen, all in the product and black sections |
| Length | 45–50 s. Four acts, see §9 |
| Audio | A close, intimate voice-over over a soft music bed. One caption per VO line |

## 3. Palette and grade

Everything is graded into one warm monochrome. Source photos go to luminance first, then through a sepia map.

| Token | Value | Use |
|---|---|---|
| `void` | `#191716` (corners 25,23,23; centre of the light pool 30,27,28) | Background. Never pure black, except the final punchline card |
| `pool` | radial light, +6 to +10 levels at centre | A faint projector pool behind the subject |
| sepia shadows | `#181512` (p1 = 24,21,18) | Darkest values inside photos |
| sepia mids | around `#8A7C70` | |
| sepia highs | `#F6E4D2` (p99.5 = 246,228,210) | Brightest skin/shirt values. Warm, never white |
| `rim` | `#E9DDCB` | The paper edge around every cut-out |
| `caption` | core `#BCBC70`, body `#B5B45B`, olive-yellow | Subtitles |
| `titleCream` | `#EFE3CE` | Title lettering on the end card |
| `titleScript` | `#D1FFF3` core, mint-cyan glow | Script sub-line on the end card, the **only** cool colour in the film |
| `burn` | red `#B8322A`, green `#5FD070` | One- or two-frame film-burn accents (see §7) |

Contrast is moderate: the photos keep deep shadows but the highlights are rolled off. Background figures are
darker and lower in contrast than the subject (§5).

## 4. The cut-out

- The subject is cut out of its photo with a **paper rim**: a 3–5 px (at 1080) band of `rim` colour that
  follows the silhouette loosely, as if cut with scissors a little outside the line. The rim is slightly soft
  (0.6–1 px blur) and slightly irregular. Hair gets a smoother, rounder cut than the true hairline.
- No drop shadows. The figure separates from the void by the rim and by its own brightness.
- Figures are whole people or big fragments: a head and shoulders, a waist-up pose, a hand holding a thing.
  Props are cut out too (a phone, a hand mirror, a rabbit, a wind-up key) and **glued onto the people**,
  often absurdly out of scale. That comic collage glue is the signature: a wind-up key on a baby's back, a dog
  with someone else's glasses.
- Puppet motion is minimal and rigid: a prop or an arm rotates on a hinge, a head tilts a few degrees, a hand
  waves. Most figures don't move at all; the camera does the work.

## 5. Depth and the camera (the core grammar)

The collage section (8–33 s in the reference) has **no hard cuts**. It is one continuous camera move
through a stack of plates.

- **The camera only retreats.** The frame keeps slowly zooming out during every line (about 2–4 % per
  second) and lurches back faster on each change (the old subject shrinks to about 45–60 % of its size within
  about 12 frames).
- **New plates come from the camera side.** The next figure enters from a frame edge, huge (about 1.5–3×
  its settled size) and **heavily defocused** (blur about 12–25 px at 1080), and slides in over 8–12 frames
  while it sharpens and settles. During the entry it overlaps the old subject like a foreground object passing
  close to the lens. The diff signal shows these as 4–10-frame runs of fast change, with no cut frame.
- **Old plates recede.** The previous subject ends up smaller, behind the new one (often over a shoulder,
  between two figures, or low in the frame), **dimmed** to about 60–75 % brightness and slightly soft (blur
  1–3 px). Two steps back a figure is a dark ghost. Three steps back it's gone.
- **Depth of field is the transition.** Blur strength follows the distance from the focus plane: big for
  near plates, small for far ones.
- **Portals.** Twice the new plate has a **hole**, and the whole previous scene ends up seen through it:
  the eyepiece of binoculars, an open mouth. The camera starts inside the hole (the old scene fills the
  frame through it) and pulls back until the person holding the hole is revealed. Every earlier plate is then
  drawn only inside the hole.
- **Scale jokes.** The receding figure ends up in a funny place: a crowd behind a single woman, a tiny
  person in a magician's hat, a face in a lens.
- Small handheld drift: ±3–6 px float on the camera, very slow.

## 6. Product (bookends)

The opening and closing are lit product photography, intercut with **hard cuts**:

- **Opening (0–8 s):** three macro shots of the product, each about 2.7 s: a black void with a sliver of
  hard light on glass edges; a top-down spotlight pool on a grained surface with the object's long shadow;
  a close-up where light sweeps across a faceted surface. Slow camera creep (push or slide), hard cuts
  between them, specks of dust in the light.
- **Closing (33–45 s):** a hard cut to the product on a reflective surface, lit from behind by a warm,
  **draped curtain of light** (soft vertical folds, peach to cream, dark at the edges); a close-up of the
  label; then a wider, centred hero shot where the **title** builds beside the product.
- **The title:** heavy, soft-serifed retro display face (Cooper Black type: bundled as Fraunces SOFT 100,
  Black), cream `#EFE3CE`, stacked over three or four lines with the small words ("of a") set smaller and
  tucked in. Each letter has a dark bevel/extrusion down-right (3–5 px) and a soft dark glow so it sits on the
  bright curtain. Under it, one line in a **cyan neon script** (Yellowtail), rotated about −6°, with a dark
  outline and a mint glow. The title words appear one line at a time on the VO.
- The last product frame gets one **red film-burn wash** for 1–2 frames before the cut to black.

## 7. Film treatment (every frame)

1. **Grain**: fine, monochrome, animated per frame, visible on the void (about 3–5 % amplitude).
2. **Vignette**: corners about 15 % darker than the centre, more on the product shots.
3. **Flicker**: exposure jitters about ±2 % per frame.
4. **Gate weave**: 0.5–1 px slow drift.
5. **Softness**: everything slightly soft, like a telecine of a print. Never razor-sharp vector edges, except
   the subtitles.
6. **Dust and burns**: occasional white or green specks (1 frame each, about one every 2 s); a rare light leak.
   Red burn wash at the end of the title (1–2 frames).
7. **Tone**: lifted blacks (`#191716`), rolled-off warm highlights.

## 8. Subtitles

- **Every VO line is captioned**, exactly as spoken, sentence case, ending in a period.
- Face: a plain grotesque bold (Arial Bold type: bundled as Arimo Bold), cap height about 2.6 % of the frame
  height (font size about 36 px at 1080), olive-yellow `#B5B45B` with a soft dark shadow (about 2 px offset,
  3 px blur, 60 % black).
- Centred horizontally. One line sits with its baseline at about 94 % of the height; two lines sit at about
  89 % and 94 %. Break long lines into two balanced lines (at most about 26 characters per line).
- The caption appears on the first spoken word and stays until the next line replaces it (a hard swap, no
  fade). A gap longer than 0.6 s with no speech clears it.

## 9. Structure (rhythm of the reference)

| t (s) | Act | What happens |
|---|---|---|
| 0–8 | **Invocation** | Three product macros with hard cuts. The voice addresses the viewer as a hero, in two or three lines ("you are…"). Slow and sincere |
| 8–33 | **The litany** | One continuous pull-back through about 18 cut-out plates. Lines start at about 2–3 s each and accelerate to about 0.8–1 s each, so the jokes pile up. One or two portal moves. The last line of the act gets a little extra hold |
| 33–45 | **Reveal** | Hard cut to the product in the light curtain. The name of the product is whispered, then the title builds line by line, then the maker's credit in script |
| 45–48 | **Button** | Hard cut to pure black. One deadpan caption-and-voice line that undercuts everything |

Rules:
- Each litany line gets its own plate. Never two lines on one plate.
- Pick each figure for its **expression** (laughing, shocked, scheming, crying, pointing). Expression carries
  the joke; the caption names it.
- The litany plates alternate size and placement: a single close face, then a group, then a waist-up figure,
  then a face again.
- Product and collage never mix: the product only appears in acts 1 and 3.

## 10. Audio

- VO: close-miked, soft, unhurried, with a little room. Lines separated by short gaps (0.2–0.6 s). Loudness
  of the whole mix about −16 LUFS integrated, LRA about 5.
- Music: a sultry, slow bed under the whole film (lounge or noir), swelling slightly into the reveal and
  **cutting dead** on the black button card, so the last line is read in silence (or near silence).

## 11. Don'ts

- No hard cuts inside the litany. No cross-dissolves anywhere.
- No colour photographs, no modern photos, no AI-smooth faces. Real period photographs only, or images that
  are indistinguishable from them.
- No drop shadows under cut-outs, no outlines in any colour but `rim`.
- No captions in any other colour, face or position, and no animated captions.
- No stepped or choppy animation in the collage: the camera glides.
- Don't let a receding plate stay bright: dim it.
- No real brand logos on products or props unless you have the right to use them.
