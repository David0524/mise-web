---
name: vintage-cutout-film
description: Make a ~48 s film in the language of a luxury commercial, built from vintage photographs cut out like paper puppets. Sepia cut-outs with a cream scissor-cut rim hang in a dark void while the camera keeps pulling back through them, each new figure sliding in huge and out of focus from right in front of the lens; a whispered voice-over with olive-yellow subtitles; lit product macros at the start, a title reveal on a backlit curtain, and a quiet closing line on black. Rendered deterministically from an HTML canvas to MP4, with a synthesised whisper VO and an original lounge score. Use when the user asks for a video in this vintage cut-out / collage / luxury-commercial style, for any subject (a company's founding, a product, a person's story), or references this skill.
---

# Vintage cutout film

A film in this style is **a script plus a stack of cut-out photos**. The engine turns a spec into frames;
the tools make the cut-outs, the voice, the music and the mix; a separate reviewer judges every render.

**Read first:** `references/style-bible.md` (the look, measured from the reference). Then
`references/writing.md` before writing a word, `references/spec.md` before writing the spec, and
`references/review-rubric.md` before reviewing.

## Files

| path | what |
|---|---|
| `references/style-bible.md` | the style, measured frame by frame: grammar, grade, cut-outs, depth, captions, structure, audio |
| `references/writing.md` | the four-act shape, line rules, picking the photo for each line, speaking it |
| `references/spec.md` | film spec format: segments, the plate stack, portals, hinged parts, scene kit |
| `references/review-rubric.md` | what the reviewer checks, and the PASS/FAIL report format |
| `engine/cutout.js` | the engine: `CF.film(canvas, SPEC, SCENES)`, plate-stack camera, depth of field, portals, treatment, captions |
| `engine/fonts/` | Arimo Bold (captions), Fraunces SOFT Black (title, a Cooper-style face), Yellowtail (script) |
| `examples/film.html` | the page that hosts a spec: copy it next to your spec, fix `ENGINE`, open `?spec=name.film.js` |
| `tools/prep.py` | photo -> graded sepia cut-out PNG with the paper rim (rembg), skyline cuts (`--sky`), island removal, `--fill-holes`, `--erase` / `--add` polygons, portal hole, `--no-rim` for products |
| `tools/vo.py` | script.json -> whispered VO (Piper TTS + LPC whisper) + `lines.json` caption timings |
| `tools/asr.py` | transcribes the VO back, line by line, to catch unintelligible lines |
| `tools/score.py` | cue.json -> original noir-lounge bed (FM piano, upright bass, brushes), cut dead at the coda |
| `tools/mix.sh` | VO over music with ducking, loudness-normalised to -16 LUFS |
| `tools/check.mjs` | lints a spec: timeline, captions, one plate per line, entry overlaps, portals, missing assets |
| `tools/render.mjs` | frames, stills (`--times`), a grid (`--grid 24`) and the MP4 with audio, in parallel workers |
| `tools/contact.sh`, `tools/compare.sh` | timestamped contact sheet; reference vs film side by side |
| `tools/foldm.py` | curtain fold contrast, to compare the reveal with the reference by one shared measure |

## Setup (once per machine)

```bash
python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" piper-tts faster-whisper scipy pillow numpy
# a Piper voice (a male voice whispers best; test with asr.py before choosing):
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json
```

Rendering needs Chromium (Playwright's, or `CHROME=/path`) and ffmpeg. `rembg` downloads its model on first use.

## Roles

You are the **orchestrator**: you write, build and fix. You never grade your own render. Spawn these with the
Agent tool, each with a complete brief (they start cold):

| role | when | gets | returns |
|---|---|---|---|
| **researcher** | step 1, in the background | the subject, the shot list from the beat sheet draft | `research/facts.md` (claim, source, confidence), images in `assets/src/` with `SOURCES.md` |
| **fact-checker** | step 3, before recording | the script, `facts.md`, freedom to search | per line: OK / WRONG / UNSOURCED, with a corrected line |
| **reviewer** | every render, a **fresh agent each round** | grid, key stills, reference comparisons, beat sheet, ASR report, the style bible and rubric | PASS/FAIL per segment and plate with numeric fixes, top 5 fixes |

Use more reviewers in parallel when a round is big (one for the litany, one for the bookends and audio).

## Procedure

1. **Brief.** Get the subject, the reference video if any, and anything the user insists on (names, a closing
   line, the product). Start the **researcher** in the background immediately.
2. **Reference stills.** If a reference video is given, extract stills and a contact sheet into the
   scratchpad (`tools/contact.sh ref.mp4 ref-sheet.jpg 2`), never into the project. They go to every reviewer.
3. **Script.** Write the four acts per `references/writing.md` into `script.json`, plus a beat sheet with the
   plate for every line. Send it to the **fact-checker**. Fix every WRONG and UNSOURCED line.
4. **Voice.** `python3 tools/vo.py script.json out/vo.wav out/lines.json --voice en_GB-alan-medium.onnx --voiced 0.3 --speed 0.88 --best-of 5`
   (Piper varies run to run; `--best-of` keeps each line's clearest take), then
   `python3 tools/asr.py out/vo.wav out/lines.json`. Fix flagged lines (`say`, `speed`, `voiced`) and redo.
   The line timings now fix the picture's clock.
5. **Cut-outs.** Keep the recipes in a `cut.sh` (one line per plate: source, crop, model, options) so every cut can be
   redone. Crop first; pick the model per the gotchas below; `--sky` for landscapes; `--hole` for portals;
   `--no-rim` for the product. Composite every cut-out on the void and look at it before using it; redo bad masks
   with another model, a tighter crop or a painted `--mask`.
6. **Spec.** Write `<name>.film.js`: segments, captions from `lines.json`, one plate per litany line placed on
   its line's start, the product scenes in `SCENES`. Run `node tools/check.mjs <name>.film.js` until clean.
7. **Music and mix.** `tools/score.py cue.json out/music.wav` with sections on the act boundaries and `stop` on
   the coda cut, then `tools/mix.sh out/vo.wav out/music.wav out/mix.wav`.
8. **Render and review loop** (below).
9. **Deliver** the MP4 (and its `--web` copy), the contact sheet, the beat sheet, `SOURCES.md` and the review log.

A complete worked example lives in the repo that introduced this skill: `video/coors/` (script, facts, cut.sh, spec,
cue, review log).

## Render and review loop

```
loop:
  render   node tools/render.mjs film.html out/grid --query spec=<name>.film.js --grid 36
           node tools/render.mjs film.html out/stills --query spec=<name>.film.js --times <one per plate + each entry midpoint>
           (from round 2) node tools/render.mjs film.html out/frames --query spec=<name>.film.js --mp4 out/<name>.mp4 --audio out/mix.wav
  compare  tools/compare.sh ref.mp4 <t_ref> out/stills/t<t>.jpg - out/cmp/<n>.jpg   for 4-6 matched moments
           (entry mid-blur, settled plate with receding plate, portal, title, caption close-up)
  review   spawn a NEW reviewer agent: style-bible.md, review-rubric.md, beat sheet, grid, stills, comparisons,
           ASR output. It returns PASS/FAIL per segment and plate with numeric fixes.
  fix      apply every FAIL (spec numbers, re-cut a photo, swap a photo, re-voice a line); re-run check.mjs
until two consecutive rounds return OVERALL: PASS
```

Keep a `review-log.md`: round number, each FAIL, what you changed. Stop and ask the user only for a creative
decision the brief can't answer (a different closing line, a photo they might object to).

## Gotchas

- **Fonts:** the page waits for all three faces before frame 0; if you add a face, add it to that wait.
- **Cut-outs, not prints.** Every litany plate is a scissor-cut figure. `--card` (a whole rectangular photo)
  turns the litany into a slideshow; reviewers fail it. Landscapes and buildings: `--sky .8` cuts along the
  skyline. Only printed matter (an ad, a label) may keep its printed border.
- **Which mask model:** `u2net_human_seg` for one or two clear figures; `birefnet-general` for crowds, groups,
  workers in machinery and busy period photos (slow, about 1.5 min and ~4 GB each: run them one at a time, three
  in parallel ran out of memory); `u2net` when BiRefNet drops a held object (a bottle); a clear glass is lost by
  every model, so force it back with an `--add` polygon (output-PNG pixels, like `--erase`);
  `isnet-general-use` for products. Check every cut on the void before using it.
- **Source size:** a source under ~1000 px upscaled to 0.8 H looks soft and its rim balloons. Look for ≥1500 px;
  if you must use a small one, `--rim 2`. Library of Congress items often have a larger `v.jpg` beside the
  `r.jpg`; Wikimedia rate-limits originals (HTTP 429): fetch a standard thumbnail width (1920) from
  upload.wikimedia.org instead.
- **Rim width** scales with the cut-out's size (default 0.5 % of the long side, about 4–5 px on screen at 0.8 H).
- **Fill the frame and overlap.** Settled plates at h 0.8–1.0; `bg` about [±0.22…0.3, -0.16…-0.2] so the old plate
  sits behind a shoulder. Watch for an old plate hidden completely behind a wide new one: park it in the empty
  void instead (e.g. [-0.45, -0.38]).
- **Faces and captions:** keep every settled plate's bottom edge at or above +0.36 H (`pos.y + y + h/2`).
- **Entries:** `fromScale` about 1.4 and `fromDist` 0.95 with `ease: 'inOut'`. Bigger starts (2.0) fill the frame
  with a blur on the first entry frame, which reads as a hard cut; `lurch` shrinks the old plate before the new
  one is on screen.
- **Portals:** the hole must be big enough to read the old scene through it once settled (radius ≥ 0.08 H): scale
  the piece up rather than accept a tiny hole and a huge auto `k`. Give `hole` in the PNG's pixels
  (`{piece, px}` from prep.py's output) and let the engine derive `k` and `bg`. Check the first entry frames: the
  old scene must fill the frame through the hole.
- **Entries overlapping:** a plate's `enter` must end before the next plate's `at`; at the fastest point of the
  litany use `enter: 0.4–0.45`.
- **The whisper:** voices differ a lot once whispered; test 2–3 Piper voices with `asr.py` before recording
  (en_GB-alan-medium was clearest here). Rephrase rather than fight a word the model can't say ("Stoker. Laborer."
  -> "Shoveled coal. Dug ditches."). ASR spells some correct pronunciations differently ("Kors", "brood",
  homophones): judge the key words by ear, not the score.
- **The title builds on its words:** put the product-name VO line on the hero shot (`at` in script.json), and match
  lines exactly (`l[2] === 'Name.'`), never with `startsWith`, which can hit an earlier line.
- **Shared measures:** give every reviewer the same measuring tools (diff signal, `foldm.py`) and the reference's
  numbers from them; two reviewers with private metrics asked for opposite curtain changes in consecutive rounds.
- **Mirrored reflections:** `reflect` mirrors about the floor line, so draw it where the object is (`dy = +(1 -
  base/h)·bh` for a PNG whose subject ends above its bottom edge).
- **Leftover shadows:** a cast shadow attached to a figure survives every mask model; cut it with `--erase` polygons
  (output-PNG pixels before padding; the island filter runs again afterwards). An automatic dark-pixel trim was
  tried and ate dark hats and faces.
- **Encodes:** grain makes the crf 17 master ~2 MB/s; share the `--web` copy.
- **Determinism:** never use `Math.random` or the clock in a scene; use `g.rng(seed)` and `s.t`.
- **Render time:** at 1440×1080 about 0.15–0.4 s a frame per worker; a 48 s film is about 1–3 min on 4 cores.
- **Historical subjects:** use real photographs of real people where they exist; never generate a real
  person's likeness. Record every source in `SOURCES.md`.
- **Brands:** a real company's logos and bottles are fine for private use; for anything public, ask the user
  whether they have the rights.
