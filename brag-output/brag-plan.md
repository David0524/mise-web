# Brag Plan: Mise (v2 — product-tour cut)

Supersedes the first cut (v1, commit `5675b8a`), which led on the dill line and never
showed the app working. This version is a walkthrough of the real flow, staged like an
iPhone app ad.

## What is this app?

Mise is a weekly cooking collaborator: you tell it about your kitchen, it proposes
dishes and changes them on your feedback, assigns them to nights, builds one shopping
list, writes the recipes, talks you through cooking at the stove, then learns from how
it went.

## The angle

An iPhone-ad product tour. The device is the hero, held still in frame while the app
does the work inside it; short confident lines of type carry the narration on the left.
The pitch is not a claim, it's the **sequence** — the fact that one app carries you from
"who's eating" all the way to "that tasted flat, remember it". Nothing is invented: every
screen is the app's own layout and copy.

The dill gets exactly one mention, in passing, as the app's own setup hint. It is a
detail, not the premise.

## Hook (first 2-3 seconds)

Black. The phone rises into frame already alive, showing Mise's own intro screen, and
one line lands beside it: **"A week of dinners, handled."** No logo yet, no claim — the
device and the promise, then straight into the product.

## Key moments (the middle)

The middle *is* the flow. Seven screens, each a real one:

- **Your kitchen** — the setup wizard: "How many people are you cooking for?", the
  stepper on 1, the real hint about package sizes, the step rail reading
  "Step 1 of 7 · Who's eating".
- **Brainstorm** — two dish cards with title, blurb and the *why* line, and a tap that
  flips "Add it" to "Added".
- **My Week** — the night cards, dishes assigned to Tuesday / Thursday / Saturday.
- **Shopping** — "Use These First" in the warn card, then the real list rows: bold
  quantity, item, the `3d` spoilage badge and a `have` badge.
- **The recipe** — "What you need" components, "Worth learning here", and the numbered
  steps with their `why` lines.
- **Cooking** — the dark stove mode: "Step 3 of 7", the progress bar, the big step
  sentence, a live timer chip, "Voice on".
- **Rating** — the stars, "Anything off about it?" and the real chips
  (Nailed it / Tasted flat / Wanted crunch).

## Outro / punchline

The captions stop. The phone settles to centre, the wordmark and the real tagline arrive
on the strong cue at 23.174s, with "$12/month · cancel anytime" beneath it.

## User flow worth showing

This whole video is the flow, end to end:
**kitchen & preferences → idea generation → the week → one shopping list → the recipe →
cooking at the stove → rating it afterwards.** Seven beats, in the app's own order.

## Tone

- Preset: `app-store` (closest of the seven to an iPhone ad — feature-clean, smooth
  reveals, no mess), pulled toward `polished` for restraint
- Creative direction: iPhone app ad — device hero on a deep plum-black seamless
  background, one short line of type per screen, cuts on the bar line
- Interpretation: nine scenes rather than the preset's 4-6, because the user asked for a
  seven-stage walkthrough and each stage needs its own screen. Pace comes from cutting
  on the beat grid, not from shortening reads: the phone never moves during a scene, the
  screen content cross-dissolves, and each caption slams in and then holds. No bounce,
  no overshoot, no gratuitous device rotation.

## Format: landscape — 1920x1080
## Duration: 24.8 seconds

Above the 15-25s sweet spot's middle and at the top of the range by design: seven
product stages plus an open and a close do not fit in 20s without outrunning the
reading floor.

## Visual identity (from the project)

- Background (the ad stage): deep plum-black gradient built from the app's own
  `--navy #12141C` and `--plum #573C56` — the device needs a dark stage for the warm
  paper UI to read as lit
- Caption text: `#F6EFE3` paper on the dark stage; accent `#EE9265` rose (the persimmon
  `#B44722` is too dark to pass AA on black — rose is the same family and clears it)
- Inside the phone: the app's in-app tokens verbatim — `--paper #FAF5F4`,
  `--surface #FFFFFF`, `--sunk #F4EBE9`, `--ink #1A1B24`, `--muted #6E6472`,
  `--hot #B44722`, `--good #2F6B54`, `--tape #F0D9D5`, `--rule rgba(87,60,86,.14)`
- Display font: Nunito 900 / 800 (local woff2)
- Body font: Nunito 600 / 700
- Strongest visual element: the app itself, shown at phone scale — the tab bar, the
  cards, the step rail, the stove mode

## Share copy (draft)

Mise is a weekly cooking collaborator: tell it about your kitchen, agree on a few
dishes, and it builds the list, writes the recipes, talks you through cooking them, and
remembers how they went.

## Audio direction

- Role: clean rhythmic bed with sparse interface accents — an ad mix, not a score
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (114.84 BPM, 113.6s).
  Swapped from v1's vol-10: its strong cues start at 1.07s and run evenly to 23.2s, so
  every scene cut can land on the grid.
- Music treatment: 0.34 from the open, 0.44 through the tour, no ducking (there is no
  typing to protect this time), fade 22.6 → 24.8 under the sign-off
- Music cue guidance: preset read from
  `assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json`.
  Beat grid ~0.5225s; a bar is 4 beats ≈ 2.09s. **Every one of the nine scene cuts is on
  a beat** — 2.647 / 5.282 / 8.441 / 10.542 / 13.177 / 15.813 / 18.959 / 21.595.
  Three explicit strong-cue locks: **6.339** (1.00 — the "Add it" tap),
  **12.655** (1.00 — the shopping list's `have` badge settling), **23.174** (0.99 — the
  wordmark landing).
- Audio-reactive treatment: subtle — the stage light behind the device breathes with the
  bass, and the device's rim highlight gains a little presence on the beat. 3-6% only,
  and nothing on the screen content itself, which must stay a clean product shot.
- SFX posture: sparse interface-grade accents. A soft switch per screen cut would be too
  busy at nine cuts, so accents go only on the three moments that mean something: the
  device arriving, the "Add it" tap, and the sign-off.
- Audio-coupled moments: device arrival (1.068); the tap (6.339); the wordmark (23.174).
- Restraint rule: no accent on a screen cross-dissolve, nothing bright, and no sound at
  all during the recipe and cooking scenes — those two should feel calm.

## Storyboard

Stage for every scene: the deep plum-black backdrop, the soft stage light, and the phone
chassis held at a fixed position right of centre. Only the screen inside it changes, and
only the caption block left of it changes. The phone itself never moves after Scene 1.

### Scene 1 — The device arrives — 2.65s (0.0 → 2.647)
Black stage. The phone rises 60px and settles, screen already showing Mise's intro: the
character mark, "I'm Mise." and the app's own promise line. Caption left, Nunito 900 at
92px: **"A week of dinners, handled."** Arrives beat-locked to 1.068.
Sequential/interaction: none — one arrival.
Audio intent: a single soft arrival, then the bed opens up.
Audio-coupled idea: `impactSoft_medium_004` at 1.068.
Music: bed in at 0.34.
Transition mood: clean cut on the beat → Scene 2

### Scene 2 — Your kitchen — 2.64s (2.647 → 5.282)
Screen: the setup wizard. Step rail "Step 1 of 7 · Who's eating", the question
"How many people are you cooking for?", the stepper reading **1**, and the app's real
hint: "Cooking for one means package sizes are the real problem. I'll design around
them." Caption: **"Start with your kitchen."**
Sequential/interaction: none — the screen is read, not operated.
Audio intent: the bed carries it; no accent.
Music: lifts to 0.44.
Transition mood: smooth cross-dissolve on the beat → Scene 3

### Scene 3 — Brainstorm — 3.16s (5.282 → 8.441)
Screen: "Pick the ones you want" over two real dish cards — title, blurb, the italic
*why* line, "About 35 minutes · Heat: medium", and the Add it / Something else pair.
**Beat-locked to the strong cue at 6.339**, the first card's button flips to "Added" and
the card takes the `--good` green edge. Caption: **"It suggests. You decide."**
Sequential/interaction: yes — a simulated tap on "Add it", with the button changing state.
Audio intent: one clean interface confirmation, the only "click" in the video.
Audio-coupled idea: `ui/click2.ogg` at 6.339, on the cue.
Transition mood: cross-dissolve on the beat → Scene 4

### Scene 4 — The week — 2.10s (8.441 → 10.542)
Screen: My Week. Three night cards — Tuesday, Thursday, Saturday — each with its dish
name and blurb, and "Make my shopping list" pinned at the bottom.
Caption: **"The week takes shape."**
Sequential/interaction: the three night cards arrive on consecutive beats
(8.441 / 8.963 / 9.497) — short two-word day labels, so the grid is safe here.
Audio intent: bed only.
Transition mood: cross-dissolve on the beat → Scene 5

### Scene 5 — One list — 2.64s (10.542 → 13.177)
Screen: Shopping. The warn card "Use These First" with two entries, then "Shopping List",
"9 still to buy. Tap any line to change it." and the real rows — bold quantity, item, the
`3d` badge on what spoils, and a `have` badge. **Beat-locked at 12.655** (cue 1.00) the
`have` badge settles onto the last row. Caption: **"One list, nothing wasted."**
Sequential/interaction: yes — rows arrive on alternating beats, then the badge lands.
Audio intent: bed only; the badge lands on the cue without a sound of its own.
Transition mood: cross-dissolve on the beat → Scene 6

### Scene 6 — The recipe — 2.64s (13.177 → 15.813)
Screen: the recipe. "Worth learning here" in the tape-coloured learn block, "What you
need" with its components, then "Steps · 7 steps · swipe →" and two numbered steps with
their grey *why* lines. Caption: **"Recipes that explain themselves."**
Sequential/interaction: none — a calm read.
Audio intent: deliberately no accent. This scene and the next are the quiet centre.
Transition mood: cross-dissolve on the beat → Scene 7

### Scene 7 — At the stove — 3.15s (15.813 → 18.959)
Screen: stove mode, the app's dark cooking surface. "Leave" / dish title / "Voice on" top
bar, a running timer chip "04:12 · sear · step 3", "Step 3 of 7" with the progress bar at
43%, the big step sentence and its why line, and the Back / Next step pair.
Caption: **"Then it cooks with you."** The timer chip counts down on the beat grid.
Sequential/interaction: yes — the timer digits tick, driven off the timeline.
Audio intent: still no accent; the bed alone.
Transition mood: cross-dissolve on the beat → Scene 8

### Scene 8 — How it went — 2.64s (18.959 → 21.595)
Screen: the rating sheet. Four of five stars filled, the app's own readback
"Really good", "Anything off about it?" and the real chips — Nailed it, Tasted flat,
Wanted crunch, Too much work — with "Tasted flat" active, and "Save this".
Caption: **"It learns what worked."**
Sequential/interaction: yes — the four stars fill one per beat
(18.959 / 19.482 / 20.016 / 20.538); they are glyphs, not text, so the grid is safe.
Audio intent: bed only.
Transition mood: cross-dissolve on the beat → Scene 9

### Scene 9 — Sign-off — 3.15s (21.595 → 24.741)
The caption column clears and the phone holds exactly where it has been all along,
screen resting on the week view. **Beat-locked to the strong cue at 23.174**, the
wordmark block fades up in the column the captions vacated: the Mise mark, "Mise" in
Nunito 900, "a weekly cooking collaborator", and "$12/month · cancel anytime". The
device never moves after Scene 1 — the lockup comes to it, not the other way round.
Music fades out under it.
Sequential/interaction: none.
Audio intent: one last warm accent, ringing into the fade.
Audio-coupled idea: `interface/bong_001.ogg` at 23.174.
Music: fade 22.6 → 24.8 to zero.
Transition mood: hold to end

**Music mood for this video:** clean 115 BPM ad bed, mixed low and even, faded under the
sign-off.
**Audio summary:** The bed opens under a single soft arrival, holds an even level through
the seven-screen tour with exactly one interface click on the strongest cue, goes
accent-free through the recipe and stove scenes so they read calm, then fades out as one
warm note lands on the wordmark.
