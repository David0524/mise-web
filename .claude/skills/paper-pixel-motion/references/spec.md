# Film spec reference

A film is one JS file that sets `window.SPEC` (so it loads from `file://` without fetch). The planner also reads
`.json` with the same shape.

```js
window.SPEC = {
  title: 'sunday sauce',
  mode: 'cut',                  // 'cut' (24 fps, hard cuts, flat sprites) | 'flow' (60 fps, handoffs, 3D blocks)
  length: 16,                   // target seconds; the planner warns if it's more than 15 % off
  size: [1440, 1080],           // optional; 4:3 default
  font: 'Outfit',               // optional; default Outfit (cut) / Geist (flow)
  shape: 'steps',               // documentation only: which writing shape this follows
  objects: ['tomato', 'garlic', /* … 10–12 sprite names */],
  silhouettes: {                // key → 'shape:hand' | 'shape:profile' | 'mask:assets/hand.png' (body in alpha) | 'heat:assets/hand.png' (a ready-made heat render on black, drawn as-is) | 'thermal:assets/hand.png' (the same kind of image re-lit through the engine's thermal ramp: violet rim → cream core. Prefer this)
    hand: 'shape:hand',
  },
  treatment: { grainAmount: 1, vignetteAmount: 1 },  // optional film-texture multipliers (a night film: ~1.7 / 1.8)
  beats: [ /* see below */ ],
};
```

## Beats

Every beat has `type` and (usually) `text`. Optional on all beats: `section` (arc section number), `world`
(`paper` | `void` | `red` | `yellow` | `#hex`), `dur` (seconds; overrides timing), `push` (camera push), `out` (`cut` | `handoff`: how this beat leaves; flow mode otherwise hands off, except into and out of spells and flashes and into heroes).
Type on `void`, `red` and `wash` defaults to white.

| type | text | fields | what it renders |
|---|---|---|---|
| `hero` | 1 word | — | Flash card with a huge word and dashed guides. In flow mode the card wipes off to the left |
| `sentence` | 3–12 words | `key` | Small line on the centre, word by word (cut) or typed and centred (flow), with the key word underlined in red. In cut mode a pen scribble writes under each new word |
| `flare` | optional line | `objects`, `key`, `objectSize`, `mosaic` (objects wake from coarse pixels) | The cyan four-point flare, floating objects, and a light pool closing in. The key word turns white |
| `silhouette` | 1–7 words | `shape`, `orbit`, `hotspot` ([x, y, r, ry?] in 1440×1080), `hotspotStrength`, `thick` (px of body thickness that reaches full heat; set it to the head's width for a profile, or only the torso gets hot), `wash`, `leftEnd`, `rightStart`, `textY` (hand text anchors) | Heat-lit body. A hand splits the line either side of it; a head puts the line on the left |
| `ring` | — | `objects`, `hits:[[t, index]]` | Inventory carousel (cut) or tilted 3D ring (flow). `hits` are ink-blot strikes in cut mode; in flow mode each is a kick (pull, ease-out, spring back), a heat flash, soot and an impact burst |
| `card` | 1 word + period | `object` (req), `accent`: `sparkle` \| `beam` \| `notes` \| `scribble` \| `orbits`, `glow` (red glow behind a dark object), `title: 'snap'` (flow: the word snaps in whole with a red collapsing cursor instead of typing), `sub` (a small subtitle under the word, e.g. an ingredient list) | Hero object on the left, the word on the right with a cursor. In flow mode the page floods from the object |
| `conveyor` | — | `objects` | Fast row of objects with speed streaks |
| `scatter` | — | `objects`, `from`: `ring` (default) \| `pile` | The ring breaks apart; objects turn to ink. In flow mode blots swallow the page |
| `spell` | 1 word (caps) | `objects`, `worlds`, `letterDur` (s per letter, default .25) | One shot per letter, with the background cycling through `worlds` and an object in the next slot. In flow mode the objects morph cell by cell |
| `resolve` | the final word | `object`, `end`: `knot` \| `word` | Brush strokes, then floating letters with red loops, converging into an ink knot or settling into the word with the object above it. Default `end`: `word` if `object` is set, otherwise `knot` (same in both modes). `end: 'brand'` lands the letters as the lower-case word at hero scale (`size`, default 300) with dashed guides, which bookends a `hero` opening. Give it `dur` ≥ 3 so the name holds ≥ 1.5 s. `land: 'snap'` (brand only) gathers the letters in 3 frames at 2.8× and pulls back in 4 (`gatherAt` s, default 45 % of the beat); `tagline` adds a small line and an orange dot under it |
| `flash` | optional 1 word | — | Flat colour frame, 2–4 frames. Subliminal: exempt from the readability and hold rules |

## Timing

- **With voice:** run `tools/word-timings.py voice.mp3 words.json --transcript "…"` and pass the file
  (`compose.html?words=words.js`, where `words.js` sets `window.WORDS = [...]`; or the second argument of
  `plan.mjs`). Each beat's text is matched to the transcript in order. A beat starts 0.12 s before its first
  word, and words reveal on their spoken times.
- **Without voice:** each type has base + per-word timing with min/max (`PPMPlan.TYPES`). The cuts speed up
  going into each section's last beat. Words reveal across the first ~60 % of the beat.
- `dur` on a beat always wins.

## Composer

`PPMCompose.build(canvas, SPEC, WORDS)` → a film whose `film.plan` holds the beats and warnings. Builders are in
`PPMCompose.builders`. To add a beat type, add a builder there and a timing rule in `PPMPlan.TYPES`.
Hand-written shots (`film.shot(...)`) can still be appended after `build()` for anything the builders don't cover.
