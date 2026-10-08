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
  silhouettes: { head: 'shape:profile', hand: 'thermal:assets/hand.png' },  // the user's hand render, re-lit through the engine's thermal ramp
  treatment: { grainAmount: 1.7, vignetteAmount: 1.8 },  // 3 a.m.: heavier grain, darker corners
  beats: [
    // awake
    { section: 0, type: 'hero', text: '3:07', world: 'void' },
    { section: 0, type: 'silhouette', shape: 'head', text: "everyone's asleep. you're not.", thick: 120, hotspot: [930, 380, 110, 150] },
    { section: 0, type: 'flash', text: 'click', world: 'yellow' },
    { section: 0, type: 'flare', text: 'might as well make ramen', key: 'ramen', objects: ['clock', 'moon', 'bulb', 'chopsticks'], mosaic: true, objectSize: 104 },
    // from scratch
    { section: 1, type: 'card', text: 'broth.', object: 'pot', title: 'snap', sub: 'bones · kombu · hours', dur: 1.3, accent: 'orbits', glow: true },
    { section: 1, type: 'conveyor', objects: ['ginger', 'garlic', 'mushroom', 'scallion', 'nori', 'soy'] },
    { section: 1, type: 'card', text: 'tare.', object: 'soy', title: 'snap', sub: 'soy · mirin · salt', dur: 1.3, accent: 'scribble', glow: true },
    { section: 1, type: 'conveyor', objects: ['flour', 'noodles', 'ajitama', 'chopsticks', 'ginger', 'garlic'] },
    { section: 1, type: 'card', text: 'noodles.', object: 'noodles', title: 'snap', sub: 'flour · water · stubbornness', dur: 1.3, accent: 'sparkle' },
    // the quiet
    { section: 2, type: 'sentence', text: 'the kitchen is the only room awake', key: 'awake' },
    { section: 2, type: 'flash', text: 'stir', world: 'void', dur: .1 },
    { section: 2, type: 'ring', hits: [[.55, 3], [.88, 7]] },
    { section: 2, type: 'silhouette', shape: 'hand', text: 'just you and the steam', leftEnd: 380, hotspot: [700, 860, 170] },
    // the bowl
    { section: 3, type: 'hero', text: 'slurp', world: 'red', dur: .9 },  // a held card, not a subliminal flash: the payoff needs a beat to land
    { section: 3, type: 'spell', text: 'RAMEN', objects: ['pot', 'soy', 'noodles', 'ajitama', 'ramen'], worlds: ['paper', 'void', 'red', 'paper', 'void'], letterDur: .45 },
    { section: 3, type: 'resolve', text: 'ramen', object: 'ramen', objectSize: 300, objectLift: 390, end: 'brand', land: 'snap', tagline: '3:58 a.m.', dur: 3.4 },
  ],
};
