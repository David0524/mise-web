# Brag Plan: Mise (v3 — the story cut)

Supersedes v2 (`0a6913a`), which toured nine app screens on a 2.6s cut and read as
"bang bang bang" rather than as anything happening to anyone. v1 (`5675b8a`) is the
reference for what worked: typed input, a thing visibly changing, motion with a reason.

## What is this app?

Mise is a weekly cooking collaborator. You tell it about your kitchen, it proposes
dishes and rewrites them when you push back, it turns the week into one shopping list,
and it talks you through cooking at the stove — then learns from how it went.

## The angle

**One Thursday, from "nothing to cook" to "that was the best thing I've made in weeks."**

The video follows a single person cooking for one through one full week of the app, and
almost never shows a screen. Instead it shows the *mechanisms* as motion, scaled up and
isolated: a number counting down to one, days lighting up, fourteen restriction chips
cascading past while two lock, thirteen equipment icons snapping into a grid, three
dishes throwing their ingredients into one list where duplicates visibly collide and
merge, a glaze going on, a timer running down, four stars filling, a typed note flying
back into next week.

Two reasons to work this way. Screens are wordy, and the interesting thing about Mise
isn't its layout — it's what it's doing underneath. Shown as motion, "every answer
changes what it suggests" stops being a claim and becomes something you watch happen.

The arc is carried by light: the film opens nearly black at six o'clock with nothing in
the fridge, warms to paper when Mise shows up, and stays warm to the end.

## Hook (first 2-3 seconds)

A clock reading **6:12** in the dark, and the honest sentence under it: "Half a cabbage,
two eggs, and no idea." No product, no logo, no claim — just the feeling the app exists
to fix. The track is genuinely quiet for the first 7s (measured: −21 dB, no strong cues
at all before 8.7s), so the open gets silence to sit in.

## Key moments (the middle)

- **The light coming on.** A warm sweep crosses the frame and the whole film changes
  temperature. This is the turn, and it's done with colour, not copy.
- **Building the kitchen — 15 seconds, the centrepiece.** The thing v2 flattened into
  one screenshot of a stepper. Here it is a machine assembling: the headcount counting
  4 → 1, the seven-day row lighting Tue/Thu/Sat, the heat meter climbing with its label
  cycling through the app's real rungs, the adventure dial sweeping to "Show me
  something new", fourteen real restriction chips cascading through frame while "No
  pork" and "Nut allergy" lock, thirteen real equipment icons snapping into a grid, and
  all of it collapsing into one card. This is what the user meant by complexity.
- **Pushing back, typed.** Three dish ideas deal in; a line is typed into the field —
  *"thursday feels too heavy"* — and on the strongest cue in the act the middle idea
  rewrites itself into a different dish. The app's own claim is "I'm not a recipe search
  box. We talk it through"; this is that, shown.
- **Three dinners, one list.** Ingredient tokens fly out of three dish cards, converge,
  and land as a single column — and two duplicate scallion tokens collide mid-air and
  merge into one line as the counter ticks. The dedup *is* the feature.
- **The stove.** The app's own terracotta photograph, a slow push in, steam rising, a
  live timer counting down, and one instruction in type big enough to read from across a
  kitchen. This is the scene that should make someone hungry.
- **It learns.** Four stars fill on the beat, a note types itself — *"the glaze was the
  best part"* — and then flies back up into next week's card, which brightens.

## Outro / punchline

"Cook something you're proud of. Every week." Then the wordmark, the real tagline, and
the price. The track has no strong cues after 55s, so the sign-off gets a quiet landing
rather than a hit.

## User flow worth showing

The whole film is the flow, in the app's order, but staged as one person's Thursday:
**the empty fridge → setting up the kitchen (7 steps) → ideas and pushing back → the
week → one shopping list → cooking it → rating it → next week is better.**

## Tone

- Preset: `cinematic`, pulled back toward `polished`
- Creative direction: a warm, patient product film — a week in one kitchen, told in
  light and motion
- Interpretation: eight acts on the music's own 4-bar phrasing, none shorter than 4.3s
  and the centrepiece 15.3s long. Long holds, slow crossfades, one idea on screen at a
  time. Motion is continuous *within* an act rather than a cut *between* acts — the
  opposite of v2. Nothing bounces; everything eases. Type is large and sparse, and never
  competes with the thing it's labelling.

## Format: landscape — 1920x1080
## Duration: 59.5 seconds

Deliberately at the length the user allowed. The 15-25s creative law is overridden here
by an explicit instruction ("the video can be up to a minute long, so don't rush it"),
and the 15s kitchen-build act only exists because the user asked for that complexity to
be shown.

## Visual identity (from the project)

- Ground: the app's own `--paper #F6EFE3`, but **animated in temperature** — the film
  starts at `#100D12` and warms to paper across Act 2
- Photography, from `public/img/` (the app's own assets, used at or below native size so
  they stay crisp): `clay.webp` 1080x1349 as the stove surface, `spices.webp` 1000x563
  as the flavour panel, `dill.webp` 900x900 in the pantry ground
- Accent: `--hot #B44722` persimmon on paper; `#EE9265` rose when type sits on dark
- Text: `--ink #1A1B24` on paper; `#F6EFE3` on dark
- Display font: Nunito 900 / 800 (local woff2); body Nunito 600 / 700
- App tokens for every recreated fragment: `--sunk #F4EBE9`, `--good #2F6B54`,
  `--tape #F0D9D5`, `--plum #573C56`, `--rule rgba(87,60,86,.14)`

## Share copy (draft)

Six o'clock, half a cabbage, no idea. Mise turns that into a week of dinners you
actually want to cook — it learns your kitchen, argues with you about the menu, builds
one shopping list, and talks you through the pan.

## Audio direction

- Role: a patient bed that builds, with accents only where something lands
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (109.96 BPM, 117.4s).
  Chosen by measuring all five bundled tracks' energy in 5s buckets: vol-12 is the only
  one that opens genuinely quiet (−21.3 dB) and climbs (−15.5 dB by 30s), which is the
  film's arc. Every other track starts at full level.
- Music treatment: 0.20 under the dark open, 0.40 from the light sweep, 0.46 through the
  kitchen build and list, eased to 0.34 for the stove so the type reads calm, fade
  56.6 → 59.5 to zero
- Music cue guidance: the shipped preset only analyses the first 25s, so the full grid
  was regenerated with the plugin's own `analyze_music_cues.py` over a 60s window →
  `assets/music/vol-12-cues-60s.json` (207 beats, 0.5457s grid, a bar = 2.183s, a 4-bar
  phrase = 8.73s). **Every act boundary is a bar line**: 7.094 / 11.459 / 26.738 /
  35.468 / 42.005 / 50.736 / 55.101. Strong-cue locks, one per act where the act has
  one: **8.742** (0.99, the light sweep), **17.473** (0.99, the adventure dial),
  **22.930** (1.00, the equipment grid completing), **32.740** (1.00, the dish
  rewriting), **38.197** (0.99, the merged list landing), **44.745** (1.00, the glaze),
  **51.293** (1.00, the fourth star). Acts 1 and 8 have no strong cues in range, which
  is why they are the quiet ones.
- Audio-reactive treatment: expressive on non-text only — the stove's heat glow and the
  steam's drift ride the bass, and the warm ground light breathes across the whole film.
  Anything carrying type stays within a 4% swing.
- SFX posture: sparse and warm, and weighted to the moments that mean something rather
  than spread evenly: the light sweep, the kitchen card closing, the typed lines, the
  dish rewrite, the list landing, the glaze, the stars.
- Restraint rule: no sound at all in Act 1 — the silence is the point — and nothing
  bright or clicky anywhere.

## Storyboard

### Act 1 — Six o'clock — 7.09s (0.0 → 7.094)
Near-black, `#100D12`, with the clay photograph at 12% as a barely-there ground. Centre
frame: **6:12** in Nunito 900 at 190px, dim paper. It ticks to **6:13** at 4.4s — the
only thing that moves. Under it, three ghosted tokens drift up one at a time: *half a
cabbage*, *two eggs*, *one tub of gochujang*. Then the line: "and no idea what to make."
Sequential/interaction: yes — three tokens arrive on beats 2.728 / 3.821 / 4.911; the
clock digit changes.
Audio intent: silence. No accent, bed at 0.20. The film should feel like the quiet
before you give up and order in.
Music: 0.20.
Transition mood: the light arrives → Act 2

### Act 2 — The light comes on — 4.37s (7.094 → 11.459)
**Beat-locked to 8.742** (0.99): a warm light sweep crosses left to right, and behind it
the entire ground warms from `#100D12` to `#F6EFE3` over 1.6s — the film changes
temperature on a cue. The Mise mark scales in from 0.8 as the warmth arrives. Type:
"Let's work it out."
Sequential/interaction: none — one continuous transformation.
Audio intent: the first sound in the film, and it should feel like relief.
Audio-coupled idea: `impactSoft_heavy_000.ogg` at 8.742, under the sweep.
Music: up to 0.40.
Transition mood: continuous — the warmth carries → Act 3

### Act 3 — Building the kitchen — 15.28s (11.459 → 26.738)
Warm paper. Kicker "YOUR KITCHEN" holds for the whole act; the headline reads "Seven
steps. Every answer changes what it suggests." The act is one continuous assembly, each
element entering on a beat of the 0.546s grid and *staying*, so the frame fills up:

- 11.459 — "Cooking for" and a numeral that counts **4 → 1** over 0.9s and lands on 1,
  with the app's real consequence line under it: "package sizes are the real problem."
- 13.108 (0.98) — the seven-day row appears; **Tue / Thu / Sat** light persimmon at
  13.642 / 14.199 / 14.733.
- 15.290 — the heat meter: five segments filling to three, its label stepping through the
  app's real rungs — "None at all" → "A little" → "Medium" — and settling.
- 17.473 (0.99) — **beat-locked**: the adventure dial sweeps across five stops and lands
  on the app's real top rung, "Show me something new".
- 18.564 (0.99) — the `spices.webp` photograph slides in as the flavour panel, giving the
  act a warm anchor so it isn't all UI.
- 19.656 → 22.372 — fourteen real restriction chips cascade through frame, two every
  beat; **No pork** and **Nut allergy** lock persimmon, the other twelve settle dim.
- 22.930 (1.00) — **beat-locked**: thirteen real equipment icons snap into a 5-column
  grid in a fast 0.09s cascade (icons, not text, so the grid can outrun the reading
  floor), then the whole grid settles as one.
- 24.555 (0.99) — everything contracts toward centre and resolves into a single card:
  "Your kitchen, set up", with the recap line "Cooking for one, three nights, medium
  heat, no pork."

Sequential/interaction: yes, throughout — this act is nothing but sequential reveal, and
the point is accumulation.
Audio intent: a build. Each group of arrivals slightly firmer than the last, ending on
one warm close when the card resolves.
Audio-coupled idea: soft `bong_001.ogg` on the day lights and the two locking chips;
`impactSoft_medium_001.ogg` on the equipment grid at 22.930; `impactSoft_medium_004.ogg`
on the card closing at 24.555.
Music: 0.46.
Transition mood: soft crossfade → Act 4

### Act 4 — It suggests, you push back — 8.73s (26.738 → 35.468)
27.295 (0.99): three dish cards deal in from a stack, fanned, then settle into a row —
title and one line each, in big type, no app chrome. At 29.5 a field appears below them
and a line **types itself character by character**: "thursday feels too heavy". At 32.740
(1.00) — **beat-locked** — the middle card lifts, flips, and comes back as a different
dish, the other two sliding to make room. Type: "It suggests. You push back."
Sequential/interaction: yes — cards deal one at a time, a line is typed, and a card
rewrites in response.
Audio intent: the conversation. Sparse keypresses under the typing, then one clean
confirmation when the dish changes.
Audio-coupled idea: `keypress-*.wav` at 0.12 on roughly every fourth character;
`impactSoft_medium_002.ogg` at 32.740 on the rewrite.
Music: 0.46.
Transition mood: soft crossfade → Act 5

### Act 5 — Three dinners, one list — 6.54s (35.468 → 42.005)
The three dishes shrink to three small labels along the top. From each, ingredient tokens
fly out on an arc and fall into a single column forming centre-frame. Two **scallions**
tokens — one from each of two dishes — collide mid-air at 37.6 and merge into one line,
its quantity bumping to "1 bunch". A counter beside the list ticks up as tokens land and
stops at **9 items**. **Beat-locked at 38.197** (0.99) the finished list snaps square.
Type: "Three dinners. One list. Nothing bought twice."
Sequential/interaction: yes — twelve tokens on the beat grid, a visible merge, a counter.
Audio intent: the satisfaction of things fitting together.
Audio-coupled idea: soft taps as tokens land, thinned so only every other one sounds;
`impactSoft_medium_004.ogg` on the snap at 38.197.
Music: 0.46.
Transition mood: the ground darkens toward the stove → Act 6

### Act 6 — Then it's just you and the pan — 8.73s (42.005 → 50.736)
The ground dims to a warm near-dark and the `clay.webp` terracotta photograph fills most
of the frame, pushing in slowly (1.0 → 1.06 across the act — a real Ken Burns move, not a
cut). Three steam paths rise and drift, their drift driven by the music's bass. A timer
reads **5:00** and counts down for real. One instruction in 68px type: "Spoon the glaze
over. Back in for five minutes." — and the app's own reason beneath it: "Any earlier and
the sugar is charcoal before the thighs are cooked." **Beat-locked at 44.745** (1.00) a
warm bloom crosses the pan as the glaze goes on. Type: "Then it's just you and the pan."
Sequential/interaction: yes — the timer runs, the steam moves, the push-in never stops.
Audio intent: warmth and patience. One low accent for the glaze, nothing else.
Audio-coupled idea: `impactSoft_heavy_000.ogg` at 44.745.
Music: eased down to 0.34 so the scene reads calm.
Transition mood: warm back to paper → Act 7

### Act 7 — And next week starts smarter — 4.37s (50.736 → 55.101)
Back to paper. Five stars; four fill on consecutive beats (50.736 / 51.293 / 51.838 /
52.384), the fourth **beat-locked to 51.293** (1.00). A note types itself: "the glaze was
the best part". At 53.5 the note detaches and flies up-left into a small card labelled
*next week*, which brightens as it lands. Type: "And next week starts smarter."
Sequential/interaction: yes — stars on the grid, a typed note, and the note travelling.
Audio intent: a small, earned lift.
Audio-coupled idea: `bong_001.ogg` on the fourth star; sparse keypresses under the note.
Music: back to 0.42.
Transition mood: soft crossfade → Act 8

### Act 8 — Sign-off — 4.40s (55.101 → 59.5)
Warm paper, empty. The line "Cook something you're proud of. Every week." holds alone,
then lifts, and the lockup arrives: the Mise mark, "Mise" in Nunito 900, "a weekly
cooking collaborator", "$12/month · cancel anytime". The music fades out under it. No
strong cue exists here and none is faked.
Sequential/interaction: none.
Audio intent: let it end quietly. One soft note as the lockup lands, then nothing.
Audio-coupled idea: `bong_001.ogg` at 56.1 on the lockup.
Music: fade 56.6 → 59.5 to zero.
Transition mood: hold to end

**Music mood for this video:** a patient 110 BPM bed that starts almost absent, builds
through the kitchen and the list, pulls back for the stove, and fades under the sign-off.
**Audio summary:** Act 1 is silent on purpose. The first sound in the film is the light
sweep at 8.742s, and from there the bed builds with the assembly, thins for the pan, and
fades out so the last note can ring into nothing.
