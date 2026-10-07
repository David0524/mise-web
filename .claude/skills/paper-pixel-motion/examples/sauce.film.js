/* Example film spec (original). Shape: "steps" (see references/writing.md).
 * Load in compose.html, or lint with: node tools/plan.mjs examples/sauce.film.js
 */
window.SPEC = {
  title: 'sunday sauce',
  mode: 'cut',                 // 'cut' | 'flow'
  length: 16,                  // target seconds (planner warns if far off)
  shape: 'steps',
  objects: ['tomato', 'garlic', 'pot', 'spoon', 'knife', 'bread', 'chili', 'lemon', 'cup', 'pan', 'whisk', 'egg'],
  silhouettes: { hand: 'shape:hand' },
  beats: [
    { section: 0, type: 'hero', text: 'slow' },
    { section: 0, type: 'sentence', text: 'start with whatever the market had left on the table', key: 'market' },
    { section: 0, type: 'flash', text: 'then' },
    { section: 0, type: 'ring' },
    { section: 1, type: 'card', text: 'chop.', object: 'knife', accent: 'scribble' },
    { section: 1, type: 'conveyor', objects: ['garlic', 'tomato', 'chili', 'lemon', 'bread', 'egg'] },
    { section: 1, type: 'card', text: 'stir.', object: 'spoon', accent: 'sparkle' },
    { section: 1, type: 'conveyor', objects: ['pot', 'pan', 'cup', 'whisk', 'knife', 'tomato'] },
    { section: 1, type: 'card', text: 'wait.', object: 'pot', accent: 'beam' },
    { section: 1, type: 'conveyor', objects: ['bread', 'lemon', 'egg', 'garlic', 'spoon', 'cup'] },
    { section: 2, type: 'silhouette', shape: 'hand', text: 'taste it then trust your own tongue' },
    { section: 2, type: 'scatter' },
    { section: 3, type: 'spell', text: 'SAUCE', objects: ['tomato', 'garlic', 'chili', 'pot', 'spoon'] },
    { section: 3, type: 'resolve', text: 'sauce', object: 'pot' },
  ],
};
