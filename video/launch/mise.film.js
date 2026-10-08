/* Mise launch hype film. Spec for the paper-pixel-motion skill (.claude/skills/paper-pixel-motion).
 * Thesis: cooking feels calm when everything has a place.  Shape: contrast (mess → method → calm).
 * Plan/lint:  node ../../.claude/skills/paper-pixel-motion/tools/plan.mjs mise.film.js
 * Render:     node ../../.claude/skills/paper-pixel-motion/tools/render.mjs index.html out/ --query fps=60 --subframes 8 --mp4 mise-launch.mp4
 */
window.SPEC = {
  title: 'mise: launch',
  mode: 'flow',
  length: 18,
  shape: 'contrast',
  objects: window.MISE_SET,
  silhouettes: { hand: 'heat:assets/hand.png' },  // the user's heat render (ChatGPT), drawn as-is
  beats: [
    // the mess
    { section: 0, type: 'hero', text: 'mess' },
    { section: 0, type: 'sentence', text: 'every good recipe starts the same way', key: 'recipe' },
    { section: 0, type: 'flash', text: 'then' },
    { section: 0, type: 'scatter', from: 'pile' },
    { section: 0, type: 'silhouette', shape: 'hand', text: 'a counter full of maybe', leftEnd: 400 },
    { section: 1, type: 'flash', text: 'so' },
    // the method
    { section: 1, type: 'card', text: 'prep.', object: 'knife', accent: 'scribble' },
    { section: 1, type: 'conveyor', objects: ['garlic', 'lemon', 'tomato', 'egg', 'salt', 'board'] },
    { section: 1, type: 'card', text: 'place.', object: 'bowl', accent: 'orbits' },
    { section: 1, type: 'conveyor', objects: ['recipe', 'timer', 'spoon', 'pan', 'bowl', 'knife'] },
    { section: 1, type: 'card', text: 'play.', object: 'pan', accent: 'sparkle', glow: true },
    // the calm
    { section: 2, type: 'sentence', text: 'everything right where your hands expect it', key: 'hands' },
    { section: 2, type: 'flash', text: 'now' },
    { section: 2, type: 'ring' },
    { section: 3, type: 'spell', text: 'MISE', objects: ['knife', 'bowl', 'pan', 'toque'] },
    { section: 3, type: 'resolve', text: 'mise', object: 'mise', objectSize: 330, objectLift: 400, end: 'brand', dur: 3.2 },
  ],
};
