# Brag Plan: Mise — hype cut

A new `/brag` run, written through the skill's own four steps. The earlier work in
`brag-output/` (v1–v6, a 59.5s story film) is kept as it is. This run is its opposite:
a 25-second hype/promo reel.

## What is this app?

Mise is a weekly cooking collaborator. You tell it about your kitchen, it pitches dinners
and rewrites them when you push back, it folds the week into one shopping list, and it
talks you through each one at the stove. Then it remembers how it went.

## The angle

**Mise's own pitch line, played as a hype reel:** *"plans the week, builds the list, talks
you through cooking it."* That sentence comes from `app/pricing/page.js`, and it's the
film's spine. Each clause gets its own slam card, and under each card the app does that
thing for real at full speed: the setup cascade, the pushback rewrite, the list merging,
the pan. The music has a real drop at 16.86s, and the cooking lands on it. That's the
payoff the whole reel builds toward.

It's specific to Mise because every word on screen is Mise's copy and every screen is
Mise's UI. The energy is new. The material isn't.

## Hook (first 2-3 seconds)

Black. An appliance clock glows **6:12 PM** (the callback to the story film, so it reads
as a time). The first beat of the track hits at 1.07 and **NO PLAN.** slams in huge. On
the next bar, 2.12, it's knocked off by **NO PROBLEM.** Two 2-word reads, each held over
a second. It's a hype-reel hook: a problem stated at full volume and dismissed in one beat.

## Key moments (the middle)

- **PLANS THE WEEK.** The phone slams in and the real personalization screen cascades:
  all fourteen restrictions, all thirteen tools, both scales filling. Beside it, three
  answers stamp and stack: COOKING FOR 1 · NO PORK. NO NUTS. · MEDIUM HEAT. ("Show me
  something new" lands on the phone's adventure scale rather than as a fourth sticker,
  which would have held for only 0.5s.)
- **It pitches, you push back.** The Brainstorm screen types "thursday feels too heavy"
  into the app's own field. On the strong cue at 12.65 the second card is rewritten
  in place.
- **BUILDS THE LIST.** Full-bleed persimmon. Ingredient tokens from three dinners rain
  down, and the counter runs to 11. Three of them are scallions, which merge into one
  row, and the count drops to the **9** you actually buy.
- **TALKS YOU THROUGH IT.** Two knife chops on the beat, then silence, then **the drop
  at 16.86**: hard cut to the pan, thighs slam into the oil, sizzle burst, flames up. The
  app's step card says "Spoon the glaze over." and the glaze pours.

## Outro / punchline

The plate spins in and four stars stamp, landing on the app's real rating chip, **Nailed
it**. Then black, and **MISE** slams in full-frame. On the strong cue at 23.17 the pitch
line lands underneath: "plans the week, builds the list, talks you through cooking it."
Then the price, **$12/month · cancel anytime**. The last hit rings out over the music fade.

## User flow worth showing

Setup (how you eat) → Brainstorm (it pitches, you push back, it rewrites) → Shopping (one
merged list) → Cooking (the step card at the stove) → Rating (stars + "Nailed it"). All of
it comes from `components/MiseApp.jsx`: the real `RESTRICTIONS`, `EQUIPMENT`, `SPICE`,
`ADVENTURE` and `MISSING_LABELS` values, the real tab names and the real placeholders.

## Tone

- Preset: `chaotic`
- Creative direction: **launch-day hype reel — a kitchen at full volume**
- Interpretation: chaotic pacing and typography: ALL CAPS Nunito 900, hard cuts, flash
  frames, zoom-cut entrances (1.2 → 1.0), words that land slightly tilted, dense SFX. It
  stays readable because every line slams in fast and then **holds** for at least its
  reading floor. That keeps it from turning into the "bang bang bang" cut the user
  rejected in the story film. The story film showed the flow slowly. This one shows the
  same flow at the speed of the beat.

## Format: landscape — 1920x1080
## Duration: 25.0s

## Visual identity (from the project)

- Background: `#0E0B10` night for the slams; `#F6EFE3` paper for the app beats;
  full-bleed `#B44722` persimmon for flash frames and the list scene
- Accent: `--hot #B44722` (the app's primary button and gochujang both); `--rose #EE9265` on dark
- Text: `#1A1B24` ink on paper, `#F6EFE3` on dark and on persimmon
- Display font: Nunito 900 (the app's own family, `app/layout.js`), shipped locally
- Body font: Nunito 700
- Strongest visual element: the app's personalization cascade and the pan, both already
  drawn for the story film. That artwork, the MiseHello mark and the device are reused.

## Share copy (draft)

Mise plans the week, builds the list, and talks you through cooking it. Here it is at full volume.

## Audio direction

- Role: dense rhythmic layer, the hype-reel posture
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (114.84 BPM). Picked by
  measurement, not by table. In 3s RMS buckets it sits at about −16.5 dB from the very
  first second (vol-12, the story film's track, opens at −21 dB), and at 16.0s it dips to
  −18.8 dB, then jumps to −15.0 by 17.0 and climbs to −13.5 by 22s. That's a genuine drop
  and build inside the 25s window.
- Music treatment: in at full posture from frame 0, no fade-in, because the hook needs
  weight. A brief duck around 16.3–16.86 into the drop, full through the cooking and the
  plate, a fade from 24.2 under the logo so the final hit rings.
- Music cue guidance: bundled preset read,
  `assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json`.
  Strong-cue locks: **3.70** (MISE name lands) · **12.65** (the idea is rewritten) ·
  **23.17** (the pitch line lands under the logo). The drop at **16.86** (a grid beat,
  energy-confirmed) is the cooking hit. Beat grid for sequential events: 6.34 / 7.40 /
  8.44 for the three stacked answers (every other beat, since they're text);
  20.28 → 21.06 for the stars (accents, every half-beat is fine).
- Audio-reactive treatment: expressive on the dark scenes, restrained on the app. Bass
  drives the pan's heat glow and a warm vignette on the slam cards. Nothing carrying type
  scales with the music.
- SFX posture: dense (chaotic), motion-matched. Punches under slams, card sounds under
  the phone and the tokens, keys under the typing, wood knocks for the knife, a metal or
  plate hit on the drop, a bell on the logo.
- Audio-coupled moments: NO PLAN / NO PROBLEM slams · MISE name · three stacked answers ·
  typing · rewrite · token rain + count · two chops · the drop · stars · logo
- Restraint rule: no SFX in the one bar before the drop (16.34 → 16.86), so the drop
  lands out of a hole. Never two loud hits within 0.15s.
- Delivery: the soundtrack in `brag.mp4` is mixed and mastered by `mix.py` (−14 LUFS,
  −1.2 dBTP) from the composition's own cue sheet, because the render's built-in mix
  plays every lane 8.5 dB low and flattens the hits. See `composition-brief.md`.

## Storyboard

### Scene 1 — Hook — 3.18s (0.00 → 3.18)
Black. Appliance clock "6:12 PM" + "THURSDAY" glows in (0.0). **NO PLAN.** slams at 1.07,
tilted −3°. At 2.12 **NO PROBLEM.** shoves it off.
Sequential/interaction: yes. Two slam lines on consecutive bars, each held ≥1.0s.
Audio intent: weight from frame one.
Audio-coupled idea: a punch under each slam.
Transition mood: flash (persimmon frame) → Scene 2

### Scene 2 — Reveal — 2.10s (3.18 → 5.28)
Full-bleed persimmon after a flash frame. "MEET" small, then **MISE.** giant, beat-locked at
3.70, with the MiseHello chef mark bouncing in. Sub-line (app copy): "a weekly cooking
collaborator", held 1.3s.
Sequential/interaction: no
Audio intent: the name is the first big payoff.
Audio-coupled idea: bell/impact on the name.
Transition mood: hard zoom cut → Scene 3

### Scene 3 — PLANS THE WEEK — 4.22s (5.28 → 9.50)
Paper. Kicker slam **PLANS THE WEEK.** The phone slams in from the right with the real
setup screen: 14 restriction chips cascade, 13 tool tiles cascade, heat fills to Medium,
adventure fills to "Show me something new". Left column: three answers stamp and **stack
and stay**: COOKING FOR 1 (6.34) · NO PORK. NO NUTS. (7.40) · MEDIUM HEAT (8.44).
Sequential/interaction: yes. Three text stamps on every other beat, each held ≥1.06s,
full set held together at the end. Chips and tiles are accents and can run on the fast grid.
Audio intent: momentum, a click under each stamp.
Audio-coupled idea: card-place per stamp, soft ticks under the cascade.
Transition mood: hard cut → Scene 4

### Scene 4 — It pitches. You push back. — 4.20s (9.50 → 13.70)
Paper, phone held. The real Brainstorm screen with two cards. Left stamps: **IT
PITCHES.** (9.50) → **YOU PUSH BACK.** (10.54) while "thursday feels too heavy" types into
the app's field → **IT LISTENS.** (12.65, beat-locked) as the second card is rewritten in
place.
Sequential/interaction: yes. Typed input, then a card rewrite.
Audio intent: typing, then a satisfying swap.
Audio-coupled idea: keypress per character, card-slide on the rewrite.
Transition mood: flash → Scene 5

### Scene 5 — BUILDS THE LIST. — 1.84s (13.70 → 15.54)
Full-bleed persimmon. **BUILDS THE LIST.** slams. Ingredient tokens rain onto a list
card, the counter runs to 11, three scallions merge into one row, and it drops to
**9 items**.
Sequential/interaction: yes. Tokens fly in (accents), and the number and headline hold.
Audio intent: a rattle of arrivals, then one lock.
Audio-coupled idea: chips-stack under the tokens, chip-lay on the 9.
Transition mood: hard cut → Scene 6

### Scene 6 — TALKS YOU THROUGH IT. — 4.48s (15.54 → 20.02)
Night. Board and knife: chop on 15.81, chop on 16.34, then nothing. **16.86 THE DROP**:
hard cut to the pan, thighs slam into the oil with squash, sizzle burst, flames up,
**TALKS YOU THROUGH IT.** slams (held to 18.44). 18.44: the app's step card slides in,
"Step 3 of 7 · Spoon the glaze over.", and the glaze pours and lands. 19.48: toss.
Sequential/interaction: yes. The chops, the drop, the pour.
Audio intent: the climax. A hole, then the hit.
Audio-coupled idea: wood knocks for chops, a heavy hit on the drop, a soft impact on the glaze.
Transition mood: hard cut → Scene 7

### Scene 7 — Nailed it — 2.10s (20.02 → 22.12)
The plate spins in. Four stars stamp across 20.28 → 21.06, and the app's rating chip
**Nailed it** pops at 21.06 and holds to 22.12.
Sequential/interaction: yes. Four star stamps, then a chip.
Audio intent: success.
Audio-coupled idea: glass or chip clinks on stars, a success hit on the chip.
Transition mood: flash to black → Scene 8

### Scene 8 — Outro — 2.88s (22.12 → 25.00)
Black. **MISE** slams full-frame at 22.12 with the mark. At 23.17 (beat-locked) the
pitch line lands: "plans the week, builds the list, talks you through cooking it."
(held 1.8s). Price pill "$12/month · cancel anytime" at 23.70.
Sequential/interaction: no
Audio intent: the last hit rings over the fade.
Audio-coupled idea: bell on the logo.
Transition mood: end

Scene total: 3.18 + 2.10 + 4.22 + 4.20 + 1.84 + 4.48 + 2.10 + 2.88 = **25.00s**. (Scene 6
opens at 15.54 so the board is already in frame when the first chop lands on 15.81.)

**Music mood for this video:** chaotic / hype
**Audio summary:** full-weight bed from frame one, a punch or card sound under every
slam, one empty bar before a real drop at 16.86 that the cooking lands on, and a bell
that rings out over the fade under the logo.
