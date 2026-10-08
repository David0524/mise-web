/* 3 a.m. ramen. Spec for the paper-pixel-motion skill (.claude/skills/paper-pixel-motion).
 * Thesis: at 3 a.m., making something slow is the calmest thing you can do.  Shape: steps, opened by a turn.
 * Plan/lint:  node ../../.claude/skills/paper-pixel-motion/tools/plan.mjs ramen.film.js
 * Render:     node ../../.claude/skills/paper-pixel-motion/tools/render.mjs index.html out/ --query fps=60 --subframes 8 --mp4 ramen.mp4
 */
window.SPEC = {
  title: '3am ramen',
  mode: 'flow',
  length: 20,
  shape: 'steps',
  objects: window.RAMEN_SET,
  silhouettes: { head: 'shape:profile', hand: 'heat:assets/hand.png' },
  beats: [
    // awake
    { section: 0, type: 'hero', text: '3:07', world: 'void' },
    { section: 0, type: 'silhouette', shape: 'head', text: "everyone's asleep. you're not." },
    { section: 0, type: 'flash', text: 'click', world: 'yellow' },
    { section: 0, type: 'flare', text: 'might as well make ramen', key: 'ramen', objects: ['clock', 'moon', 'bulb', 'chopsticks'], mosaic: true, objectSize: 104 },
    // from scratch
    { section: 1, type: 'card', text: 'broth.', object: 'pot', title: 'snap', sub: 'bones · kombu · hours', accent: 'orbits', glow: true },
    { section: 1, type: 'conveyor', objects: ['ginger', 'garlic', 'mushroom', 'scallion', 'nori', 'soy'] },
    { section: 1, type: 'card', text: 'tare.', object: 'soy', title: 'snap', sub: 'soy · mirin · salt', accent: 'scribble' },
    { section: 1, type: 'conveyor', objects: ['flour', 'noodles', 'ajitama', 'chopsticks', 'ginger', 'garlic'] },
    { section: 1, type: 'card', text: 'noodles.', object: 'noodles', title: 'snap', sub: 'flour · water · stubbornness', accent: 'sparkle' },
    // the quiet
    { section: 2, type: 'sentence', text: 'the kitchen is the only room awake', key: 'awake' },
    { section: 2, type: 'flash', text: 'stir', world: 'void' },
    { section: 2, type: 'ring', hits: [[.55, 3], [1.05, 7]] },
    { section: 2, type: 'silhouette', shape: 'hand', text: 'just you and the steam', leftEnd: 420 },
    // the bowl
    { section: 3, type: 'flash', text: 'slurp', world: 'red' },
    { section: 3, type: 'spell', text: 'RAMEN', objects: ['pot', 'soy', 'noodles', 'ajitama', 'ramen'], worlds: ['paper', 'void', 'red', 'paper', 'void'] },
    { section: 3, type: 'resolve', text: 'ramen', object: 'ramen', objectSize: 300, objectLift: 390, end: 'brand', land: 'snap', tagline: '3:58 a.m.', dur: 3.4 },
  ],
};
