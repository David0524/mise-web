# Reviewer rubric

You review a render of a vintage-cutout film. You get: the contact sheet (`grid.jpg`), full-size stills of key
moments, matching **reference stills** from the style reference (technique only, never content), the beat
sheet (VO lines with times and the plate for each), and `references/style-bible.md`. You did not make the
film. Judge it as a viewer who knows the reference well.

Return, for every segment and every litany plate:

```
<id> (<t0>–<t1> s, <what it is>): PASS | FAIL
  - <issue>: <what you measured or saw> -> <fix with numbers: px, H units, frames, seconds, hex, %>
```

Then `OVERALL: PASS` only if nothing failed, and the **top 5 fixes by visual impact**. Be strict: "close
enough" is a FAIL if someone who knows the reference would notice. Don't rewrite the script unless a line
breaks a caption rule or is factually wrong.

## Global checks

1. **Grade**: one warm monochrome. Void about `#191716` (never pure black outside the coda card), photo
   shadows about `#181512`, highlights warm and rolled off (no white above about 246,230,212). No photo left
   neutral grey or cool. No colour except the title script and the burn accents.
2. **Treatment**: grain visible on the void, vignette, slight softness. Nothing razor-sharp except the
   captions.
3. **Cut-outs**: every figure has the cream paper rim (3–5 px at 1080), loosely following the silhouette, no
   leftover background chunks, no halos of the old background, no chopped-off hands or heads unless clearly
   deliberate. Glued-on props make a point, not a gag.
4. **Captions**: Arimo/Arial bold type, olive-yellow `#B5B45B`, soft dark shadow, centred, baseline at about
   94 % of H, cap height about 2.6 % of H, at most 2 lines, each line under about 26 characters, the text matches the
   VO word for word, appears with the first word, hard swaps.

## The litany (the core)

| check | must be |
|---|---|
| Continuity | no hard cut anywhere in the stack; every change is a plate entering from near the lens |
| Entry | the new plate starts big (1.5–3× settled) and blurred (≥ 12 px at 1080), slides in over 10–15 frames, settles sharp |
| Recession | the previous plate shrinks to about 45–60 %, ends up behind and readable for one more line, dimmed to about 60–75 %, then fades out two or three steps back |
| Drift | the camera keeps creeping back while a line plays; never a dead freeze |
| Composition | the subject's face sits in the upper two-thirds, never under a caption. Sizes alternate (close face, group, waist-up). The receding plate sits somewhere meaningful (over a shoulder, in a hand, in a hat) |
| Expression | each figure's expression or action fits its line, so the feeling reads without the caption; nothing mocks the subject |
| Portal | if used: the old scene is visible through the hole at the start, the pull-back reveals the hole's owner, and no older plate leaks outside the hole |
| Rhythm | lines accelerate through the act; the last line of the act holds a beat longer |

## Product and title

- The opening macros look like lit product photography: hard light on edges, deep shadow, dust in the beam,
  slow creep, hard cuts between shots.
- Reveal: the product on a glossy floor with a reflection, a warm backlit curtain, darker edges.
- Title: soft heavy serif, cream with a dark bevel and glow, stacked, small words tucked in; the script line
  in mint-cyan neon, rotated about −6°; each builds on its VO line.
- One red burn wash for 1–2 frames, then a hard cut to pure black for the coda line.

## Audio (from the beat sheet and the ASR check)

- The ASR transcript of the VO matches the script (minor homophones OK; a missed key word is a FAIL).
- Every caption matches a VO line and sits within ±2 frames of its onset.
- The music cuts dead at the black card.

## Comparing to reference stills

Compare technique only: rim width, blur on entering plates, dim of receding plates, grain amount, caption size
and colour, grade. Estimate numbers from the images and state both values, e.g. "rim 9 px vs ref 4 px ->
prep.py --rim 4"; "receding plate brightness 95 % vs ref ~70 % -> stack dim .34".
