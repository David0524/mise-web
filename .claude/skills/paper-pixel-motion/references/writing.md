# Writing engine: from a brief to a film spec

Write the words before touching any visuals. The film is a spec file (`*.film.js`, see `spec.md`). The planner
(`tools/plan.mjs`) times it and lints it, and the composer renders it. This page is how to write that spec.

## 0. Intake → one-sentence thesis

From the user's brief, write **one sentence** that the film proves. Everything else serves it.

> brief: "a reel for my cooking newsletter"
> thesis: *good food is patience you can taste.*

If you can't write the thesis, ask the user one question. Don't guess at a whole script.

## 1. Pick a shape

A shape is the order of ideas. Pick the one that fits the thesis, and vary the skeleton freely. Never copy another film's script or shot order; these skeletons are starting points, not templates to fill.

| Shape | Arc | Best for | Beat skeleton |
|---|---|---|---|
| **question** | ask → refuse the easy answer → show what it really is → land a word | manifestos, personal essays | sentence(question) · flash · silhouette(the turn) · card · conveyor · card · sentence(what it really is) · scatter · resolve |
| **steps** | do this → then this → then this → the result | recipes, processes, how-it's-made | hero · sentence(setup) · ring · (card · conveyor)×3 · silhouette · scatter · spell · resolve |
| **inventory** | "these things" → each one says something → together they're one thing | brand worlds, "about me", a product's features | sentence · ring · card×4–5 · conveyor · scatter · resolve |
| **contrast** | before / after, or them / us, alternating | launches, rebrands, change | hero · (sentence(paper) · card(void))×3 · silhouette · resolve |
| **countdown** | 3 · 2 · 1 → reveal | events, launches, drops | flash · card · flash · card · flash · card · spell · resolve |
| **letter** | "dear ___" → what you gave me → what I'll do → sign-off | thank-yous, tributes, anniversaries | sentence(salutation) · silhouette · ring · card×2 · silhouette · resolve(name) |

## 2. Budget the words

The style is **sparse**. Count before you polish.

| Length | Total spoken words | Shots | Cards | Sentence beats |
|---|---|---|---|---|
| 10 s | 15–22 | 10–12 | 1–2 | 1 |
| 15 s | 22–35 | 14–18 | 2–3 | 1–2 |
| 20 s | 30–45 | 18–24 | 3 | 2 |
| 30 s | 45–70 | 26–34 | 3–5 | 3 |

- **Sentence beats:** 3–12 words, one line, lower-case, readable at about 3.5 words/s.
- **Card words:** exactly one word plus a period, the **three words that must land hardest**. Concrete
  verbs or nouns ("chop.", "patience.", "home."), never adjectives ("amazing.").
- **Silhouette lines:** 1–7 words, said by a body. They answer or command ("you keep going.", "made by hand").
- **Hero and spell words:** the single word the film is about. The opening hero word can be the first spoken word.
- **Resolve:** the spell word again, or the name or brand.

## 3. Voice rules

- Lower-case, short, conversational, second person or first person. Punctuation: a period or a question mark,
  apostrophes optional.
- One idea per line. If a line has "and", it is probably two beats.
- Prefer a turn: set up an expectation in one beat, flip it in the next ("how do you…?" → "you don't."). The
  cut on the flip is the strongest moment in the film.
- Concrete beats abstract: name the object ("the chipped mug"), not the feeling ("nostalgia").
- No slogans, hashtags or calls to action on screen. A brand name may appear once, in the resolve.

## 4. Choose objects (10–12)

Objects are the subject's life in pixels, not illustrations of the words.

- Mix three kinds: **tools** (what they use), **tokens** (what they keep), **tells** (a quirk only they'd own).
- Each card word needs a **hero object** that carries it by association, not literally (patience → pot, not a clock).
- Avoid logos and brands. Prefer objects that read at 16×16: strong silhouette, 2–3 colours.
- If an object can't be drawn as a simple grid sprite, mark it for an image prompt (`image-prompts.md`).

## 5. Map to beats

Write the spec's `beats` from the shape skeleton:

1. Put the spoken words onto beats in order. Every spoken word lives in exactly one beat's `text`.
2. Give text-less beats (`ring`, `conveyor`, `scatter`) to the music between lines.
3. Mark `section` numbers at each turn of the arc. The planner speeds up the cuts going into each section's last beat.
4. Use each beat field only when it changes something: `key` (underlined word), `accent` (card effect), `object`,
   `shape`, `objects` (a subset for this beat), `world` (override), `dur` (override).

## 6. Plan, lint, revise

```
node tools/plan.mjs film.film.js [words.json]
```

Fix every **error**, then read every **warning**:

- **"too fast to read"** → cut words, or give the beat a `dur`.
- **"same type and world back to back"** → insert a contrasting beat, or switch one beat's world.
- **"one world for N s"** → alternate worlds.
- **"average shot is slow"** → split long beats; add a conveyor or flash.
- **"duration vs requested"** → add or remove beats; don't stretch them.

Then read the beat sheet aloud against a timer. If a line feels rushed when spoken, it will be unreadable on screen.

## 7. Hand off

Show the user **the thesis, the script (lines only) and the beat sheet** before rendering anything. Script changes
are cheap now and expensive after a render.

## Worked example (shape: steps)

> thesis: *the best sauce is the one you didn't rush.* · 16 s · cut
> script: **slow** / start with whatever the market had left / **chop. stir. wait.** / taste it then trust it / **sauce**
> objects: tomato, garlic, pot, spoon, knife, bread, chili, lemon, cup, pan, whisk, egg

See `examples/sauce.film.js` for the spec and `node tools/plan.mjs examples/sauce.film.js` for the beat sheet.
