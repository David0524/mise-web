# Reviewer rubric

You are the reviewer in the build loop. You get the contact sheet(s), the full-res stills, `style-bible.md`, the
beat sheet and, optionally, reference stills of the style. Judge **each shot** and return:

```
SHOT <n> (<t_start>–<t_end>s, <archetype>): PASS | FAIL
  - <issue>: <measured observation> → <concrete fix with numbers: px, frames, hex, opacity, seconds>
OVERALL: PASS only if every shot passes. List the top 3 fixes by visual impact.
```

Be strict. "Close enough" is a FAIL if a viewer who knows the style would spot it. Don't comment on the copy's
wording unless it breaks the type rules.

## Global checks (every shot)

1. **Film treatment** is visible: grain in flat areas, vignette (strong on paper), no clean digital flat fields.
   Blacks are about `#141414` and paper about `#E1E3E2`, never pure.
2. **World**: paper, void, red, or a flash colour. Accent discipline: red only, or the one cyan flare.
3. **Three textures** (clean type / crunchy pixels / soft glow-ink) are present across each section, and no single
   texture owns more than about 2 s.
4. **Softness**: type slightly soft with ink spread; sprites crisp inside with a slight bloom; nothing aliased or jagged
   except pixel edges.

## Per-technique checks

| Technique | Must look like |
|---|---|
| Sentence type | Tiny (about 2.3 % of H), Medium, on the vertical centre line, left at about 4 % W, lower-case, word by word, newest word greyer |
| Hero word | About 25–30 % of H, Bold, tight tracking, dashed guides edge to edge, on a flash card or paper |
| Card word | About 4 % of H, SemiBold, white, trailing period, thin blinking bar cursor about 2.5 em to the right, hero object on the left |
| Scribble | Thin pen line with a pressure taper, choppy (on twos), writes on in 4–8 frames, related to a word (under, around) |
| Brush smear | Soft grey wide body plus a dark thin core, sweeping, gone within about 6 frames |
| Spray blot | Dense core plus speckled spray edge (not a clean circle). It turns the object it hits into a black silhouette |
| Splatter | Ochre spikes, radial, 1–2 frames |
| Pixel sprite | Chunky readable pixels, 1-px dark outline, 2–3 tones, no smoothing blur, no brand logos |
| Carousel | Overlapping ring, front items bigger, slow rotation, fills about 60 % × 50 % of the frame |
| Conveyor | Single row, fast, motion-blurred, red speed streaks |
| Flare | Concave four-point astroid with long thin points; huge dithered version has visible stochastic dots and a glowing rim |
| Thermal silhouette | Hot cream core → yellow → orange → red edge, outer bloom, enters blurred and red then settles |
| Orbit ring | Thin off-white comet line that passes behind and then in front of the subject |
| Red loops | Thin red pen ellipses orbiting each letter, redrawn every 2 frames |
| Transitions | Hard cuts on beats. Flash cards last 1–3 frames, whips 3–6 frames. No crossfades |

## Timing checks

- Average shot about 0.8–1.2 s. Holds of 1.5 s or more only on calm wide shots, and cuts tighten before section ends.
- Word reveals align with audio onsets when audio exists (±2 frames).
- Card words: object lands, then the word appears ≤ 3 frames later; the cursor blinks at about 4 Hz.

## Comparing against reference stills (if given)

Compare **technique only**: grain amount, vignette depth, type scale on screen, sprite pixel size, glow falloff,
stroke weights, colour values. Estimate numbers from the images (sample hex values, measure px heights) and state
both values, e.g. "sentence cap height 17 px vs ref 18 px → OK", "grain too weak: flat paper std ≈ 2 vs ref ≈ 6 →
raise overlay alpha .16→.26".
