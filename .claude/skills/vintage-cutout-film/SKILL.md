---
name: vintage-cutout-film
description: Make a ~48 s mock-luxury-ad film out of vintage photographs cut out like paper puppets. Sepia cut-outs with a cream scissor-cut rim hang in a dark void while the camera keeps pulling back through them, each new figure sliding in huge and out of focus from right in front of the lens; a whispered voice-over with olive-yellow subtitles; lit product macros at the start, a title reveal on a backlit curtain, and a deadpan last line on black. Rendered deterministically from an HTML canvas to MP4, with a synthesised whisper VO and an original lounge score. Use when the user asks for a video in this vintage cut-out / collage / mock-perfume-ad style, for any subject (a company's founding, a product, a person's story), or references this skill.
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
| `tools/prep.py` | photo -> graded sepia cut-out PNG with the paper rim (rembg), optional portal hole |
| `tools/vo.py` | script.json -> whispered VO (Piper TTS + LPC whisper) + `lines.json` caption timings |
| `tools/asr.py` | transcribes the VO back, line by line, to catch unintelligible lines |
| `tools/score.py` | cue.json -> original noir-lounge bed (FM piano, upright bass, brushes), cut dead at the button |
| `tools/mix.sh` | VO over music with ducking, loudness-normalised to -16 LUFS |
| `tools/check.mjs` | lints a spec: timeline, captions, one plate per line, entry overlaps, portals, missing assets |
| `tools/render.mjs` | frames, stills (`--times`), a grid (`--grid 24`) and the MP4 with audio, in parallel workers |
| `tools/contact.sh`, `tools/compare.sh` | timestamped contact sheet; reference vs film side by side |

## Setup (once per machine)

```bash
python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" piper-tts faster-whisper scipy pillow numpy
# a Piper voice (deep male works best whispered):
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json
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

1. **Brief.** Get the subject, the reference video if any, and anything the user insists on (names, a button
   line, the product). Start the **researcher** in the background immediately.
2. **Reference stills.** If a reference video is given, extract stills and a contact sheet into the
   scratchpad (`tools/contact.sh ref.mp4 ref-sheet.jpg 2`), never into the project. They go to every reviewer.
3. **Script.** Write the four acts per `references/writing.md` into `script.json`, plus a beat sheet with the
   plate for every line. Send it to the **fact-checker**. Fix every WRONG and UNSOURCED line.
4. **Voice.** `python3 tools/vo.py script.json out/vo.wav out/lines.json --voice en_US-ryan-high.onnx`, then
   `python3 tools/asr.py out/vo.wav out/lines.json`. Fix flagged lines (`say`, `speed`, `voiced`) and redo.
   The line timings now fix the picture's clock.
5. **Cut-outs.** For each plate, run `tools/prep.py` on the chosen photo (crop first; `--model
   u2net_human_seg` for people, `isnet-general-use` for objects; `--hole` for portals; `--keep-bg` for
   backdrops). Look at each cut-out on the void before using it; redo bad masks with a manual `--mask`.
6. **Spec.** Write `<name>.film.js`: segments, captions from `lines.json`, one plate per litany line placed on
   its line's start, the product scenes in `SCENES`. Run `node tools/check.mjs <name>.film.js` until clean.
7. **Music and mix.** `tools/score.py cue.json out/music.wav` with sections on the act boundaries and `stop` on
   the button cut, then `tools/mix.sh out/vo.wav out/music.wav out/mix.wav`.
8. **Render and review loop** (below).
9. **Deliver** the MP4, the contact sheet, the beat sheet and `SOURCES.md`.

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
decision the brief can't answer (a different button line, a photo they might object to).

## Gotchas

- **Fonts:** the page waits for all three faces before frame 0; if you add a face, add it to that wait.
- **Rim width** scales with the cut-out's size; a figure shown small gets a relatively thick rim. Prep at a
  size close to how big it will appear (`--max`), or pass `--rim`.
- **rembg** misses thin props (canes, glasses) and keeps background chunks between arms. Check every cut-out
  on the void; fix with a crop or a painted `--mask`.
- **Faces under captions:** keep faces above y = 0.25 H in settled plates.
- **Portals** need `k × hole radius ≥ 0.85` so the hole starts beyond the frame edge, and `bg = pos + hole
  centre`. `check.mjs` warns about both.
- **Entries overlapping:** a plate's `enter` must end before the next plate's `at`; at the fastest point of the
  litany use `enter: 0.4`.
- **Determinism:** never use `Math.random` or the clock in a scene; use `g.rng(seed)` and `s.t`.
- **Render time:** at 1440×1080 about 0.15–0.4 s a frame per worker; a 48 s film is about 1–3 min on 4 cores.
- **Historical subjects:** use real photographs of real people where they exist; never generate a real
  person's likeness. Record every source in `SOURCES.md`.
- **Brands:** a real company's logos and bottles are fine for private use; for anything public, ask the user
  whether they have the rights.
