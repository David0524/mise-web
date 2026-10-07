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
  silhouettes: {                // key → 'shape:hand' | 'shape:profile' | 'mask:assets/hand.png' (body in alpha)
    hand: 'shape:hand',
  },
  beats: [ /* see below */ ],
};
```

## Beats

Every beat has `type` and (usually) `text`. Optional on all beats: `section` (arc section number), `world`
(`paper` | `void` | `red` | `yellow` | `#hex`), `dur` (seconds; overrides timing), `push` (camera push).

| type | text | fields | what it renders |
|---|---|---|---|
| `hero` | 1 word | — | Flash card with a huge word and dashed guides. In flow mode the card wipes off to the left |
| `sentence` | 3–12 words | `key` | Small line on the centre, word by word (cut) or typed and centred (flow), with the key word underlined in red. In cut mode a pen scribble writes under each new word |
| `flare` | optional line | `objects`, `key` | The cyan four-point flare, floating objects, and a light pool closing in. The key word turns white |
| `silhouette` | 1–7 words | `shape`, `orbit`, `hotspot`, `wash` | Heat-lit body. A hand splits the line either side of it; a head puts the line on the left |
| `ring` | — | `objects`, `hits:[[t, index]]` | Inventory carousel (cut) or tilted 3D ring (flow). `hits` are ink-blot strikes |
| `card` | 1 word + period | `object` (req), `accent`: `sparkle` \| `beam` \| `notes` \| `scribble` \| `orbits` | Hero object on the left, the word on the right with a cursor. In flow mode the page floods from the object |
| `conveyor` | — | `objects` | Fast row of objects with speed streaks |
| `scatter` | — | `objects` | The ring breaks apart; objects turn to ink. In flow mode blots swallow the page |
| `spell` | 1 word (caps) | `objects`, `worlds` | One shot per letter, with the background cycling through `worlds` and an object in the next slot. In flow mode the objects morph cell by cell |
| `resolve` | the final word | `object`, `end`: `knot` \| `word` | Brush strokes, then floating letters with red loops, converging into an ink knot or settling into the word with the object above it. Default `end`: `word` if `object` is set, otherwise `knot` (same in both modes) |
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
