# Golden: the founding of Coors

A ~52 s film in the `vintage-cutout-film` style (`.claude/skills/vintage-cutout-film`): period photographs cut
out like paper puppets, a whispered voice-over with subtitles, product macros, a title reveal and a quiet
closing line. Private, not for public use: several images are archive scans used without a licence.

| file | what |
|---|---|
| `script.json` | the script: 23 lines in four acts, each with the plate it plays over; `say` steers pronunciation |
| `research/facts.md` | every claim with sources and confidence (fact-checked independently before recording) |
| `assets/src/` | the source photos used, with `SOURCES.md` (where each came from) |
| `cut.sh` | makes every cut-out in `assets/cut/` from `assets/src/` (needs the skill's `tools/prep.py` and rembg) |
| `golden.mp4` | the finished film (web encode, 1440x1080, 25 fps, 50.9 s) |
| `golden.film.js` | the film spec: beat sheet, plate stack, product scenes |
| `film.html` | the page that renders it (`film.html?spec=golden.film.js`) |
| `lines.js` | VO line timings (generated from `out/lines.json`), the film's clock |
| `cue.json` | the score's cue sheet |

## Rebuild

```bash
SK=../../.claude/skills/vintage-cutout-film/tools
PY=/path/to/venv/python                        # with rembg, piper-tts, faster-whisper, scipy (see the skill's SKILL.md)
$PY -I $SK/vo.py script.json out/vo.wav out/lines.json --voice en_GB-alan-medium.onnx --voiced 0.3 --speed 0.88
python3 -c "import json;open('lines.js','w').write('window.LINES = '+json.dumps(json.load(open('out/lines.json')))+';\n')"
PY=$PY ./cut.sh
$PY -I $SK/score.py cue.json out/music.wav && $SK/mix.sh out/vo.wav out/music.wav out/mix.wav -2
node $SK/check.mjs golden.film.js
node $SK/render.mjs film.html out/frames --query spec=golden.film.js --mp4 out/golden.mp4 --audio out/mix.wav --web
```
