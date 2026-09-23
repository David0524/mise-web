# Mise promo video

Tooling that produced the 48-second, 1920×1080 promo. Everything is generated:
real screen recordings of the app, a motion-graphics layer, and a synthesized
soundtrack. Nothing here ships with the app.

## Pipeline

1. **Run the app locally with a fixed week draw.** The recording needs the
   week's seed to match the mocked AI replies, so apply the one-line hook
   temporarily (don't commit it):

   ```sh
   git apply promo/seed-hook.patch
   npx next build
   SESSION_SECRET=promo-secret-promo-secret-12345 SKIP_PAYWALL=1 npx next start -p 3000
   ```

2. **Record the walkthrough** (`walk.mjs`). Playwright signs a session cookie,
   stubs `/api/storage` and answers `/api/chat` from `mocks.mjs` (a miso +
   eggplant week), then clicks through intro → setup → ideas → week → shopping
   list → guided cooking → "Is the eggplant done?". `REC=1` captures Chrome
   screencast frames to `frames/` with timestamps. Leave both off to get
   step screenshots in `s/` instead.

   ```sh
   cd promo && npm i playwright@1.56.1 jose@5.9.6
   mkdir -p s && REC=1 VIDEO=1 node walk.mjs
   ```

   Then turn the variable-rate frames into a 30 fps sequence in `rec/`
   (build a concat list from `frames.json`, then
   `ffmpeg -f concat -safe 0 -i concat.txt -vf fps=30 -q:v 2 rec/%05d.jpg`).

3. **Music** — `python3 music.py` (numpy) writes `music.wav`: 120 BPM,
   F–Dm–B♭–C, so every scene cut lands on a bar line.

4. **Composite** — `render.html` is a timeline driven by `render(t)`. It
   maps recording time into phone mockups and animates the type.
   `frame.mjs` steps it at 30 fps. It needs `dill.webp` (from `public/img`) and
   Nunito/Caveat in `fonts/fonts.css` alongside it.

   ```sh
   ALL=1 node frame.mjs
   ffmpeg -framerate 30 -i out/%05d.jpg -i music.wav -c:v libx264 -crf 18 \
     -pix_fmt yuv420p -af volume=-2dB -c:a aac -b:a 192k -shortest mise-promo.mp4
   ```

5. `git checkout components/MiseApp.jsx` to drop the seed hook.

## Storyboard

| Time  | Scene |
|-------|-------|
| 0–4   | "Nobody needs a whole bunch of dill." |
| 4–8   | Meet Mise — your sous chef for the week |
| 8–14  | 01 Your kitchen (setup recording) |
| 14–20 | 02 This week (ideas recording) |
| 20–24 | 03 The order (week sort) |
| 24–30 | 04 The list (shopping) |
| 30–38 | 05 At the stove (guided cooking + ask Mise) |
| 38–42 | Plan. Shop. Cook. — Nothing wasted. |
| 42–48 | End card + CTA |
