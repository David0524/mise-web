# Brag Plan: Mise

## What is this app?

Mise is a weekly cooking collaborator — a sous chef that plans your week, builds a
shopping list around what actually gets used up, and talks you through cooking it at
the stove. What makes it impressive is the problem it takes seriously: for people
cooking for one or two, **package sizes** are the real problem, not portions. Nobody
needs a whole bunch of dill for one dish.

## The angle

Almost every cooking app gives you recipes. Mise's premise is that recipes were never
the bottleneck — the grocery store's packaging was. The video leads with the product's
own funniest, most specific line ("Nobody needs a whole bunch of dill for one dish"),
then proves it by showing the shopping list *actually reacting* to that complaint.

The joke is real and the joke is the feature. That's the whole video: state the absurd
little grievance everyone who cooks alone recognizes, then show the app doing something
about it. No SaaS language, no "streamline your meal planning."

## Hook (first 2-3 seconds)

The landing page headline, full-frame, in the app's own Nunito 900 on its own warm oak
paper: **"Nobody needs a whole bunch of dill for one dish."** The line settles, then a
drawn bunch of dill appears beside it and all but two sprigs fade to grey — the waste,
visible, before any product has been shown.

## Key moments (the middle)

- **Mise herself arrives on the real glass card** — the exact `MiseHello` SVG from
  `app/page.js`, on the same translucent glass card with the specular rim the signup
  page uses. Not a redrawn approximation; the actual artwork.
- **Three verbs from the real pricing copy** land one at a time: *plans the week*,
  *builds the list*, *talks you through it*.
- **The shopping list, working.** The Shopping tab recreated with a real-looking list,
  and the app's actual placeholder typed into its note field:
  *"I don't want a whole bunch of dill"*. On submit, the dill row rewrites itself from
  "1 bunch · dill" to "2 sprigs · dill" with a second line explaining where the rest
  goes. That row change is the product's entire thesis in one beat.

## Outro / punchline

Back to paper. The app's own sentence, which is the thesis stated plainly:
**"Cooking for one means package sizes are the real problem."** Then the wordmark:
Mise — a weekly cooking collaborator — $12/month.

## User flow worth showing

Three beats of actually using it, and the centerpiece is beat 2–3:

1. **Entry** — open Mise, meet the sous chef, see the week's shape.
2. **Key action** — tell it a constraint in plain language ("I don't want a whole bunch
   of dill") in the Shopping tab's note field.
3. **Result** — the list rewrites the quantity and tells you where the remainder goes,
   instead of making you buy a bunch and throw most of it away.

## Tone

- Preset: `polished`
- Creative direction: quiet premium product film in warm kitchen daylight — a well-made
  domestic object, filmed calmly
- Interpretation: four scenes, long holds, soft crossfades, no hard cuts. The type does
  the work; motion is restrained (short travel, `power3.out`, nothing bounces). The
  humor is in the copy, so the direction stays straight-faced. Confidence through
  restraint, per the `polished` preset.

## Format: landscape — 1920x1080
## Duration: 20.0 seconds

## Visual identity (from the project)

Extracted from `lib/authStyles.js`, `app/layout.js`, and `app/page.js`:

- Background: `#F6EFE3` pale oak paper, over `public/textures/oak.webp`, with the real
  `DAYLIGHT` north-light gradient stack layered on top
- Accent: `#B44722` persimmon (brick), edge `#813318`, rose `#EE9265`
- Text: `#1A1B24` ink; muted `#6E6472`; plum `#573C56`
- Display font: Nunito 900 / 800 (shipped locally as woff2)
- Body font: Nunito 600 / 700
- Strongest visual element: the `MiseHello` chef-hat character SVG on the translucent
  glass card (`S.card` — `rgba(255,255,255,.62)` fill, white hairline rim, inset
  specular highlight, plum-tinted drop shadow)

## Share copy (draft)

Nobody needs a whole bunch of dill for one dish. So I built Mise — it plans your week,
builds the list around what actually gets used up, and talks you through it at the stove.

## Audio direction

- Role: warm bed with sparse, motion-matched accents
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` (110 BPM, 60s, the
  calmest of the bundled tracks — suits `polished`)
- Music treatment: starts at 0 under the hook at 0.30, eases to 0.42 for the product
  scenes, ducks to 0.30 behind the typing so the keypresses read, then fades out
  17.6 → 20.0 so the final accent rings over silence
- Music cue guidance: preset read from
  `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.json`
  (tempo 109.96, 109 beats, 64 strong cues). Beat grid is ~0.546s.
  Strong cues targeted: **6.014** (intensity 0.92 — Mise card reveal), **14.733**
  (0.93 — the dill row resolving), **15.824** (0.96 — outro line). Beat-grid window for
  the three sequential verb chips: 6.281 / 7.349 / 8.220 (every *other* beat, ~1.0s
  apart, so each 3-word chip clears the reading floor).
- Audio-reactive treatment: subtle — bass band drives the warmth and presence of the
  daylight glow behind the glass card, and the card's own shadow depth. 3-6% swing on
  anything carrying text. No waveform bars, no pulsing orbs.
- SFX posture: sparse and warm. Low high-frequency-risk files only
  (`impactSoft_medium`, `bong_001`, `keypress-*` at low gain).
- Audio-coupled moments: hook settle; card arrival; three chips one by one; the note
  field typing; submit; the row rewrite; the outro line; the wordmark ring-out.
- Restraint rule: no SFX on a text exit, nothing bright or clicky repeated, and the
  music never swells louder than the typing it sits under.

## Storyboard

### Scene 1 — The dill problem — 5.5s (0.0 → 5.5)

Full-frame warm oak paper with the real daylight gradients. The hook line sits centered
in Nunito 900 at ~118px ink: "Nobody needs a whole bunch of dill for one dish." It rises
6px into place and settles — beat-locked to 0.824. At 2.7s a hand-drawn bunch of dill
fades in to the right of the line; at 3.5s all but two sprigs desaturate to grey and
drop to 25% opacity, leaving two green sprigs. Small plum caps bottom-left: MISE.
Settled read time for the 9-word hook: 2.7s before the dill draws any attention.
Sequential/interaction: none — one settle, then the dill's two-stage fade.
Audio intent: a single warm, soft landing under the line, then near-silence so the joke
lands in the quiet.
Audio-coupled idea: `impact/impactSoft_medium_001.ogg` at the line's settle (0.824).
Music: low warm bed at 0.30.
Transition mood: soft crossfade → Scene 2

### Scene 2 — Meet Mise — 4.5s (5.5 → 10.0)

The glass card assembles center-frame — real `S.card` treatment — carrying the actual
`MiseHello` SVG at 260px and, beneath it, "I'm Mise, your sous chef" in Nunito 800.
The card scales 0.94 → 1 and lifts 18px, **beat-locked to 6.014**. Then three chips in
persimmon-tinted glass arrive one at a time on the beat grid, each holding once shown:
"plans the week" (6.281) · "builds the list" (7.349) · "talks you through it" (8.220).
All three hold together until 10.0.
Sequential/interaction: yes — three chips arrive one by one, every other beat (~1.0s
apart), and all three stay on screen for the last 1.8s of the scene.
Audio intent: arrival and warmth — the product appearing, not announcing itself.
Audio-coupled idea: `impactSoft_medium_004` on the card; `interface/bong_001.ogg` at
each chip, same timestamp as the visual.
Music: bed eases up to 0.42.
Transition mood: soft crossfade → Scene 3

### Scene 3 — The list, working — 5.5s (10.0 → 15.5)

The Shopping tab, recreated: a glass panel headed "Shopping" with five list rows in the
app's real row style (quantity left in plum, item name in ink) — *1 bunch · dill*,
*2 · chicken thighs*, *1 · napa cabbage*, *1 tub · gochujang*, *400g · rice*. Below the
list, the app's real note field with its real placeholder. From 10.6 to 12.3 the line
**"I don't want a whole bunch of dill"** types in character by character. At 12.5 the
field submits (button depresses). At 13.108 the dill row rewrites: quantity crossfades
"1 bunch" → "2 sprigs" and a second line slides down under it in plum:
"the rest goes in Thursday's soup". The row's glass warms toward persimmon and holds.
A soft resolve accent lands on the strong cue at **14.733** as the row settles to rest.
Sequential/interaction: yes — text types character by character into a real field, the
submit is simulated, and the row updates in place afterward.
Audio intent: the quiet satisfaction of a computer doing the annoying arithmetic for you.
Audio-coupled idea: sparse `keyboard/keypress-*.wav` on roughly every third character at
0.14 gain; `ui/click2.ogg` on submit; `impact/impactSoft_medium_002.ogg` on the rewrite.
Music: ducked to 0.30 under the typing, back to 0.40 after submit.
Transition mood: soft crossfade → Scene 4

### Scene 4 — Package sizes — 4.5s (15.5 → 20.0)

Back to clean paper. The thesis line arrives in Nunito 800 at ~86px ink, **beat-locked
to 15.824**: "Cooking for one means package sizes are the real problem." It holds
through 18.0 (9 words, 2.2s settled). At 18.553 it lifts away and the wordmark block
replaces it: the small `MiseHello` mark, "Mise" in Nunito 900, the real tagline "a
weekly cooking collaborator" in muted, and "$12/month · cancel anytime" in plum. Holds
to 20.0 as the music fades out under it.
Sequential/interaction: none — two held statements.
Audio intent: settle and sign off; the last accent rings into silence.
Audio-coupled idea: `impact/impactSoft_heavy_000.ogg` on the thesis line (15.824);
`interface/bong_001.ogg` on the wordmark (18.553), left to ring as the bed fades.
Music: fade 17.6 → 20.0 to zero.
Transition mood: hold to black-free end (paper holds) — end of video

**Music mood for this video:** upbeat-but-restrained warm corporate bed at 110 BPM, mixed
low and faded out under the sign-off.
**Audio summary:** A warm bed opens quiet under the hook, lifts slightly as Mise appears
and the three verbs tick in on the beat grid, ducks so the typing reads as typing,
resolves with one soft warm hit when the dill row rewrites itself, then fades out so the
final wordmark accent rings into silence.
