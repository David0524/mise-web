# Hyperframes Composition Brief: Mise

## Objective

Create a short launch-style brag video for Mise, a weekly cooking collaborator that
plans your week, builds a shopping list around package sizes, and talks you through
cooking at the stove.

## Output

- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20.0 seconds

## Source Material

- Project root: `/home/user/mise-web`
- Primary files read: `README.md`, `app/page.js`, `app/pricing/page.js`,
  `app/layout.js`, `lib/authStyles.js`, `components/MiseApp.jsx`, `public/textures/`
- Product name: Mise
- Tagline / strongest claim: "Nobody needs a whole bunch of dill for one dish."
- Key UI or visual moment to recreate: the `MiseHello` chef-hat character SVG on the
  translucent glass card from `lib/authStyles.js` (`S.card`), and the Shopping tab's
  list rows plus its plain-language note field
- Copy that must appear verbatim:
  - "Nobody needs a whole bunch of dill for one dish." (`app/page.js` h1)
  - "I don't want a whole bunch of dill" (`components/MiseApp.jsx:5071` placeholder)
  - "Cooking for one means package sizes are the real problem."
    (`components/MiseApp.jsx:4426`)
  - "plans the week, builds the list, talks you through cooking it"
    (`app/pricing/page.js`, split into three chips)
  - "a weekly cooking collaborator" (`app/layout.js` metadata title)
  - "$12/month · cancel anytime" (`app/pricing/page.js`)

## Creative Direction

- Tone preset: `polished`
- Creative direction: quiet premium product film in warm kitchen daylight
- Interpretation: four scenes, long holds, soft crossfades only. Short-travel motion
  with `power3.out`; nothing bounces or overshoots. The copy carries the humor, so the
  direction stays straight-faced — confidence through restraint.
- Angle: every cooking app ships recipes; Mise's premise is that recipes were never the
  bottleneck — grocery packaging was. Lead with the product's own funniest and most
  specific line, then prove it by showing the shopping list actually react to that
  complaint. The joke is the feature.
- Hook: the landing-page headline full-frame on the app's own oak paper, then a bunch of
  dill where all but two sprigs grey out.
- Outro / punchline: "Cooking for one means package sizes are the real problem." →
  wordmark, tagline, $12/month.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Any food photography — this product's identity is drawn, not photographic

## Visual Identity

- Background: `#F6EFE3` pale oak, over `public/textures/oak.webp`, with the project's
  real `DAYLIGHT` radial-gradient stack from `lib/authStyles.js` layered above it
- Text: `#1A1B24` ink; `#6E6472` muted; `#573C56` plum
- Accent: `#B44722` persimmon; `#813318` seated edge; `#EE9265` rose
- Display font: Nunito 900 / 800 — shipped locally at `assets/fonts/nunito-{800,900}.woff2`
  with in-file `@font-face` (lint requires this; no CDN font link)
- Body font: Nunito 600 / 700 — `assets/fonts/nunito-{600,700}.woff2`
- Visual references from the project:
  - `MiseHello` SVG, copied path-for-path from `app/page.js`
  - `S.card` glass: `rgba(255,255,255,.62)` fill, `1px solid rgba(255,255,255,.75)` rim,
    inset specular top highlight, `0 18px 44px -16px rgba(87,60,86,.28)` shadow, 30px radius
  - `S.btn` seated edge: `0 2px 0 #813318` plus inset white highlight
  - Shopping row style: quantity in plum 800, item in ink 600

## Storyboard

Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:

1. **The dill problem** — 5.5s — read the hook in full; see two sprigs survive out of a
   whole bunch
2. **Meet Mise** — 4.5s — see the real character artwork on the real glass card; read
   three verbs arriving one at a time
3. **The list, working** — 5.5s — watch "I don't want a whole bunch of dill" typed into
   the app's real note field, then watch the dill row rewrite itself to 2 sprigs
4. **Package sizes** — 4.5s — read the thesis line; see the wordmark and price

## Audio

- Audio role: warm bed with sparse, motion-matched accents
- Audio arc: quiet under the hook → lifts as Mise appears and the verbs tick in →
  ducks under the typing → one warm resolve on the row rewrite → fades out so the final
  accent rings into silence
- Music: `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`
- Music treatment: 0.30 under the hook, 0.42 for the product scenes, ducked to 0.30
  behind the typing, fade 17.6 → 20.0 to zero
- Music cue guidance: preset read from
  `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json`
  (tempo 109.96; beat grid ~0.546s). Beat-lock targets: **6.014** (card reveal, strong
  cue 0.92), **14.733** (row resolve, 0.93), **15.824** (outro line, 0.96). Beat-grid
  window for the three verb chips: 6.281 / 7.349 / 8.220 — every *other* beat, so each
  3-word chip clears the reading floor.
- Audio-reactive treatment: subtle. `assets/music/audio-data.json` (30fps, 16 bands,
  1800 frames) is extracted and present. Drive the daylight glow's opacity/scale and the
  glass card's shadow depth from the bass band; keep anything carrying text within a
  3-6% swing. No waveform bars, no equalizers, no pulsing orbs.
- Audio-coupled moments:
  - Scene 1, hook settle (0.824) — warm soft landing
  - Scene 2, card arrival (6.014) — major reveal, beat-locked
  - Scene 2, three chips (6.281 / 7.349 / 8.220) — card-like sequential reveal
  - Scene 3, note field (10.6 → 12.3) — sparse keypresses, roughly every third character
  - Scene 3, submit (12.5) — simulated user action
  - Scene 3, row rewrite (13.108) + settle (14.733) — the payoff
  - Scene 4, thesis line (15.824) — beat-locked
  - Scene 4, wordmark (18.553) — final accent, rings over the fade
- SFX selection guidance: warm, low high-frequency-risk files only. Repeated sounds
  (keypresses) stay at 0.14 gain or below. Nothing bright or clicky more than once.
- SFX analysis guidance:
  `/root/.claude/plugins/cache/brag/brag/0.2.2/skills/brag/assets/sfx/sfx-analysis.md`
  — chosen from its "Safest General Picks": `impact/impactSoft_medium_{001,002,004}.ogg`,
  `impact/impactSoft_heavy_000.ogg`, `interface/bong_001.ogg`, `ui/click2.ogg`,
  `keyboard/keypress-*.wav`
- Exact SFX choice: filenames, timestamps, density, and volume chosen against the
  implemented animation, as above.
- Audio files: copied into `brag-output/composition/assets/` (`music/`, `sfx/`, `fonts/`,
  `textures/`)

## Hyperframes Instructions

Built against the installed domain skills — `hyperframes-core` (composition contract and
`data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec,
beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), `hyperframes-cli`
(lint/check/render). This is the `/brag` workflow, not the generic
`product-launch-video` route, so the intent interview is skipped.

Requirements:

- Show at least one real UI, copy, or visual element from the source project — met three
  times over (character SVG, glass card, Shopping rows and note field).
- Keep all text readable in the final render; every read clears the floor in
  `step-2-plan.md` (short label ≥0.8s settled, sentence ≥0.3s per word).
- Keep the video within 15-25 seconds — 20.0s.
- Include the planned music and SFX layer.
- Beat-lock 3 major moments within ±0.15s and snap the 3 sequential chips to alternating
  beats within ±0.10s; mark each with `// beat-locked` / `// beat-grid`.
- Wire at least one visual element to the extracted audio data via per-frame
  `tl.call()` sampling, not a single tween.
- Use local assets only — no CDN fonts, no remote media. GSAP loads from the pinned
  jsDelivr URL the scaffold ships with.
- Run `npx hyperframes check` before render — brag's single gate.
