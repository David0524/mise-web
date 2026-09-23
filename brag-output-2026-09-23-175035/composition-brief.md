# Hyperframes Composition Brief: Mise — hype cut

## Objective
Create a 25-second hype/promo launch video for Mise, the weekly cooking collaborator.

## Output
- Composition directory: `brag-output-2026-09-23-175035/composition/`
- Rendered video: `brag-output-2026-09-23-175035/brag.mp4`
- Format: landscape — 1920x1080, 30fps
- Duration: 25.0 seconds

## Source Material
- Project root: `/home/user/mise-web`
- Primary files read: `app/page.js`, `app/pricing/page.js`, `app/layout.js`,
  `components/MiseApp.jsx`, `lib/authStyles.js`, `public/img/`
- Product name: Mise
- Tagline / strongest claim: "A weekly cooking collaborator — plans the week, builds the
  list, talks you through cooking it." (`app/pricing/page.js`)
- Key UI to recreate: the setup wizard's personalization options (all 14 `RESTRICTIONS`,
  all 13 `EQUIPMENT`, the `SPICE` and `ADVENTURE` scales), the Brainstorm screen with a
  typed pushback and a rewritten idea, the merged shopping list, the stove step card, and
  the rating with the real `MISSING_LABELS` chip "Nailed it".
- Copy that must appear verbatim:
  - "plans the week, builds the list, talks you through cooking it"
  - "a weekly cooking collaborator"
  - "Nailed it"
  - "thursday feels too heavy" (the app's own placeholder)
  - "$12/month · cancel anytime" (from `$12/month` and "Cancel anytime.")
  - "None at all", "Medium", "Food I already know", "Show me something new"

## Creative Direction
- Tone preset: `chaotic`
- Creative direction: launch-day hype reel — a kitchen at full volume
- Interpretation: ALL CAPS Nunito 900 slam cards, hard zoom cuts, flash frames, a tilted
  sticker for every answer, dense contact SFX. Every read still holds its floor: a slam
  arrives in 0.3–0.5s and then holds.
- Angle: the app's own pitch sentence is the spine. Each clause gets a slam card, and
  under it the app does that thing for real at the speed of the beat. The cooking lands on
  the track's real drop at 16.86s.
- Hook: 6:12 PM on an appliance clock → NO PLAN. → NO PROBLEM.
- Outro / punchline: MISE, full frame → the pitch sentence → $12/month · cancel anytime
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Waveform or visualizer graphics

## Visual Identity
- Background: `#0E0B10` (night), `#F6EFE3` (paper), `#B44722` (persimmon, full-bleed)
- Text: `#1A1B24` on paper, `#F6EFE3` on night and persimmon
- Accent: `#B44722`; `#EE9265` on dark
- Display font: Nunito 900, embedded locally (`assets/fonts/`)
- Body font: Nunito 700
- Visual references from the project: MiseHello chef mark, the app's card, chip and
  button styles
- Food: real photography, four CC0 photographs (knife and board, wok of hot oil, glaze
  close-up, plate), graded as one shoot with `media-treatment` (`food-pop` 0.8, vignette
  0.3, grain 0.16). Motion comes from the camera plus physically motivated layers: steam
  from seeded noise, deterministic oil spatter, a bass-driven burner glow. No drawn food.

## Storyboard
Use the storyboard in `brag-plan.md` as the creative contract.

1. Hook — 3.18s — clock 6:12 PM · NO PLAN. · NO PROBLEM.
2. Reveal — 2.10s — MEET / MISE. / a weekly cooking collaborator
3. PLANS THE WEEK — 4.22s — phone setup cascade + stacked answer stickers
4. It pitches. You push back. — 4.20s — Brainstorm, typed pushback, rewrite
5. BUILDS THE LIST — 1.84s — tokens rain, the count runs to 11, scallions merge, 9 items
6. TALKS YOU THROUGH IT — 4.48s — photo punch-ins on the chops, the drop into hot oil, the glaze close-up under the step card
7. Nailed it — 2.10s — a real plate, four stars, the chip
8. Outro — 2.88s — MISE, the pitch line, the price

## Audio
- Audio role: dense rhythmic layer
- Audio arc: full weight from frame one; a hole in the bar before the drop; the drop;
  a bell rings out over the fade under the logo
- Music: `assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.mp3`
- Music treatment: bed at the skill's ceiling (0.5) from 0; a dip 16.34 → 16.86 into the
  drop; fade 24.2 → 25.0.
- Delivery mix: `mix.py` builds the delivered soundtrack from this composition's own
  `<audio>` tags (same files, times and levels, with the bed automation mirrored) and
  masters it to −14 LUFS / −1.2 dBTP, then muxes it onto the rendered picture. The reason
  is measured, not assumed: `hyperframes render` played a bed-only test 8.5 dB under its
  source at `data-volume="1"`, and on this cut it capped the punches near −12 dBFS with
  an LRA of 2.3. `data-volume` is clamped to 1, a media element's volume can't exceed 1,
  and a +8.5 dB per-lane gain stage clipped each lane before the loss, so none of it could
  be fixed from inside the composition without distortion.
- Music cue guidance: bundled preset
  `assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json`
  (114.84 BPM). Strong-cue locks: 3.70 (MISE), 12.65 (the rewrite), 23.17 (the pitch
  line). The drop at 16.86 is a grid beat confirmed by RMS (−18.8 dB at 16.0 → −15.0 at 17.0).
- Audio-reactive treatment: expressive on the dark scenes (warm vignette and the pan's
  heat glow ride the bass), none on anything carrying type
- Audio-coupled moments: hook slams · MISE · stickers · typing · rewrite · token rain and
  count · chops · drop · glaze · toss · stars · chip · logo
- SFX selection guidance: punches for slams, wood for the knife, heavy metal for the pan,
  card slide for the rewrite, chips for the list, glass for the stars, bells for MISE and
  the logo. Nothing in 16.34 → 16.86.
- SFX analysis guidance: `skills/brag/assets/sfx/sfx-analysis.md`. Low and medium
  high-frequency-risk files throughout, except two casino chip sounds rated high
  (`chips-stack-1` twice under the token rain, `chips-collide-1` once on the chip). Each is
  a single short isolated accent, which the analysis allows for chaotic tones.
- Exact SFX choice: chosen against the implemented animation
- Audio files: copied into `composition/assets/`

## Hyperframes Instructions
Built with `hyperframes-core`, `hyperframes-animation` (kinetic-beat-slam, zoom-through
and overexposure transitions, particle-burst), `hyperframes-creative` (audio-reactive),
`hyperframes-keyframes` and `hyperframes-cli`. `npx hyperframes check` is the gate.
