# Hyperframes Composition Brief: Mise (v4 — the cooking cut)

## Objective

A one-minute launch film for Mise, a weekly cooking collaborator — staged as one
Thursday, from an empty counter at 6:12pm to a plate worth photographing.

## Output

- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080, 30fps
- Duration: 59.47 seconds

## Source Material

- Project root: `/home/user/mise-web`
- Primary files read: `README.md`, `app/page.js`, `app/pricing/page.js`, `app/layout.js`,
  `lib/authStyles.js`, `components/MiseApp.jsx`, `public/img/`
- Product name: Mise
- Copy that must appear verbatim, all of it the app's own:
  - "Cooking for one means package sizes are the real problem. I'll design around them."
  - the seven setup step names, and "Step 7 of 7"
  - all fourteen `RESTRICTIONS` and all thirteen `EQUIPMENT` values
  - the `SPICE` rungs "None at all" / "A little" / "Medium"
  - the `ADVENTURE` top rung "Show me something new"
  - "thursday feels too heavy" and "the glaze was the best part" (real placeholders)
  - "a weekly cooking collaborator", "$12/month · cancel anytime"

## Creative Direction

- Tone: `cinematic` for the cooking, `default` for the app beats, held together by one
  palette and one light arc
- What a cooking ad does: food in motion, close and warm, cut to rhythm. What a tech ad
  does: one idea, the mechanism revealed as something satisfying, a confident payoff.
  This puts both on one timeline, and gives the app's logic the same physical language as
  the pan.
- Every cooking action is DRAWN AND ANIMATED — there is no footage in this repository, so
  the knife, the oil, the sizzle, the glaze, the flames and the plate are SVG under
  physics, not stock or stills.
- Easing is per-object, not global: `back.out(1.5)` plus a squash frame for anything that
  lands, `power4.in` for the knife coming down, `ease: none` for ballistic particles,
  `power1.in` for an accelerating pour, `power3.out` reserved for type.
- Avoid: app screenshots (wordy, and they hide the mechanism), abstract filler, generic
  SaaS language, anything that moves without a reason.

## Visual Identity

- Ground animated in temperature: `#0E0B10` counter → `--paper #F6EFE3` from the light
  sweep → `--stove #17110F` for the cooking
- Accent `--hot #B44722` (which is also gochujang-glaze colour); `--rose #EE9265` on dark
- Food palette: board `#9A6A3C`, pan `#2A2529`/`#4A424C`, oil `#D9A54A`, thigh
  `#C98A4B`/`#8E5327`, glaze `#8E2F16`, scallion `#4E7A3F`/`#E8EFE2`, flame
  `#E8481A`→`#FFB347`, plate `#FFFFFF`, rice `#F7F2E6`
- Nunito 900/800 display, 600/700 body, shipped locally as woff2

## Storyboard

Use `brag-output/brag-plan.md` as the creative contract. Eight acts on the music's own bar
grid, cooking given the largest block:

1. **0.000** Thursday, 6:12pm — appliance clock with a blinking colon, three lonely
   ingredients landing with weight. Silent.
2. **7.094** The light comes on — warm sweep on a strong cue, ground warms, mise en place.
3. **11.459** Your kitchen — four plates become one, pans drop onto three nights, three
   chillies light, thirteen equipment icons pop, fourteen restriction chips cascade.
4. **22.372** It suggests, you push back — ideas deal in, a line types itself, one idea is
   rewritten on the cue.
5. **28.921** Three dinners, one list — eleven tokens fly out and land as nine rows; three
   scallions are absorbed into one.
6. **33.286** THE COOKING, six beats of one bar each — chop · oil · sizzle · heat · glaze ·
   toss.
7. **46.370** The plate, and what it learned — the dish assembles, then stars, a typed
   note, and the note flying into next week.
8. **55.101** Sign-off.

## Audio

- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (109.96 BPM),
  chosen by measuring all five bundled tracks in 5s RMS buckets — the only one that opens
  genuinely quiet (−21.3 dB) and climbs
- Cue source: full grid regenerated with the plugin's own `analyze_music_cues.py` over a
  60s window (the shipped preset only covers 25s) → `assets/music/vol-12-cues-60s.json`
- Treatment: 0.20 under the dark open → 0.46 through the app beats → **0.30 for the whole
  cooking block so the contact sounds carry** → 0.42 for the plate → fade out
- Strong-cue locks: 8.742 · 17.473 · 22.930 · 27.295 · 32.740 · 38.197 · 42.562 · 44.745 ·
  48.019 · 51.293
- SFX are contact sounds only: four chops, oil, the drop into hot fat, the glaze, the
  toss, the plate, the star. Warm, low high-frequency-risk files throughout.
- Audio-reactive: the pan's heat glow and the steam's drift ride the bass; the warm ground
  light breathes across the film. Nothing carrying type moves more than 4%.

## Requirements

- `npx hyperframes check` must pass — brag's single gate.
- Deterministic only: the sizzle burst is a fixed pool whose position is a pure function
  of flight time from an index-seeded hash, driven by one `ease: none` tween, so a seek to
  any moment shows the correct mid-flight frame. No `Math.random`, no clocks.
- Pours draw via `pathLength` + `strokeDashoffset` rather than `getTotalLength()`, so no
  DOM measurement is involved and the stream is exact at any seek.
- Local assets only — no CDN font, no remote media; GSAP is vendored.
