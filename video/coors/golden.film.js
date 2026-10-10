/* "Golden": the founding of Coors, in the vintage-cutout-film style.
 * Open with film.html?spec=golden.film.js   Render: see README.md
 * Clock: out/lines.json from tools/vo.py (copied into lines.js as window.LINES).
 *
 * Beat sheet (t = segment start; VO line timings in lines.js)
 *  act 1  0.00  macro: bottle neck, a sliver of hard light      "You are the snowmelt of the Rockies."
 *         2.88  macro: spotlight pool, long bottle shadow        "You are the master of the mash."
 *         5.20  macro: light sweeps the label                    "You put the gold into Golden."
 *  act 2  7.60  stack, one plate per line, the camera only pulls back:
 *         young Adolph · young brewery workers · steerage · bricklayer · stoker (portal: the bricklayer seen
 *         through the porthole) · Stenger brewery · kegs · 1880s brewery under Table Mountain · Adolph older ·
 *         liquor poured into a sewer · malted milk ad · man drinking from a stein · porcelain plant · woman
 *         waiting · crowd waving hats · 1933 couple laughing over a beer
 *  act 3 39.68  label close-up in the light curtain (music)
 *        42.32  hero bottle, title builds on its line            "The Golden Brewery." "Since 1873." "Adolph Coors."
 *        48.12  red burn
 *  act 4 48.20  black                                            "Still brewed in Golden."
 */
(function () {
  const L = window.LINES;
  const start = (i) => L[i][0];
  const fr = (t) => Math.round(t * 25) / 25;               // snap to the frame grid
  // captions: hold each line until the next when the gap is short
  const captions = L.map(([a, b, t], i) => [a, L[i + 1] && L[i + 1][0] - b < 0.6 ? L[i + 1][0] : b + 0.25, t]);

  const T_A2 = 2.88, T_A3 = 5.2, T_STACK = 7.6, T_REVEAL = 39.68, T_HERO = 42.32, T_BLACK = 48.2, END = fr(L[L.length - 1][1] + 0.9);

  // litany plates: [image, h, x, y, from, bg (where the old plate goes), extra]
  // h and y keep every settled plate's bottom edge above the captions (pos.y + y + h/2 <= 0.36)
  const P = [
    ['adolph_young', 0.86, 0.02, -0.11, 'bottom', null],
    ['brewers', 0.82, 0.04, -0.09, 'right', [-0.44, -0.22], { enter: 0.95 }],
    ['steerage', 0.82, -0.04, -0.09, 'left', [-0.42, -0.22], { k: 1.8, fromScale: 1.1, fromDist: 2.2, entryEase: 'inOut', enter: 0.85 }],
    ['bricklayer', 0.9, 0.1, -0.13, 'right', [-0.26, -0.16]],
    // portal: the porthole (PNG px 1009,527 r116) sits at screen (0, -0.36); the bricklayer scene lives inside it
    ['stoker', 1.35, 0, 0, 'camera', null, { hole: { piece: 0, px: [1009, 527, 116, 116] }, pos: [-0.132, -0.14], k: 4.2, fromScale: 2.2, enter: 1.6, nearBlur: 14 }],
    ['stenger', 0.62, -0.02, -0.04, 'bottom-left', [-0.34, -0.28], { fromScale: 1.15, fromDist: 1.05, enter: 1.0 }],
    ['kegs', 0.8, 0.12, -0.08, 'right', [-0.26, -0.18], { fromScale: 1.25, fromDist: 0.7, enter: 0.95 }],
    ['tannery', 0.7, -0.04, -0.03, 'left', [0.26, -0.2], { keep: 1.9 }],
    ['adolph_old', 0.82, 0.12, -0.09, 'bottom-right', [-0.26, -0.17]],
    ['sewer', 0.8, -0.06, -0.08, 'left', [0.4, -0.22], { fromScale: 1.25, fromDist: 0.75, enter: 0.8 }],
    ['maltedmilk', 0.62, 0.1, -0.03, 'right', [-0.26, -0.15], { enter: 0.6 }],
    ['nearbeer', 0.72, -0.06, -0.1, 'left', [0.3, -0.2], { enter: 0.45 }],
    ['porcelain', 0.75, 0.08, -0.05, 'right', [-0.3, -0.2], { enter: 0.45 }],
    ['waiting', 0.8, -0.02, -0.04, 'bottom', [0.3, -0.22], { enter: 0.45 }],
    ['hats', 0.8, 0.02, -0.1, 'right', [0.44, -0.3], { fromDist: 2.2, fromScale: 1.1, entryEase: 'inOut', enter: 0.65 }],
    ['beerad', 0.82, 0, -0.07, 'left', [0.4, -0.26], { enter: 0.8, fromDist: 0.75 }],
  ];
  const plates = P.map(([img, h, x, y, from, bg, extra], j) => Object.assign({
    at: j === 0 ? T_STACK : fr(start(3 + j) - 0.12),
    from, fromScale: 1.25, fromDist: 0.95, ease: 'inOut', pieces: [{ img, x, y, h, rot: [[0, (j % 2 ? 1 : -1) * 0.8], [3, (j % 2 ? -1 : 1) * 0.6]] }],
  }, bg ? { bg } : {}, extra || {}));

  const assets = {};
  for (const n of ['adolph_young', 'brewers', 'steerage', 'bricklayer', 'stoker', 'stenger', 'kegs', 'tannery', 'adolph_old', 'sewer', 'maltedmilk', 'nearbeer', 'porcelain', 'waiting', 'hats', 'beerad', 'bottle']) assets[n] = `assets/cut/${n}.png`;

  window.SPEC = {
    title: 'golden', size: [1440, 1080], fps: 25, duration: END, blackPoint: '#191716',
    assets, audio: 'out/mix.wav', captions,
    burns: [{ at: 48.12, dur: 0.08, color: 'rgba(190,40,30,.85)', x: -0.3, y: -0.1 }],
    segments: [
      { at: 0, dur: T_A2, scene: 'macroNeck' },
      { at: T_A2, dur: T_A3 - T_A2, scene: 'macroPool' },
      { at: T_A3, dur: T_STACK - T_A3, scene: 'macroLabel' },
      { at: T_STACK, dur: T_REVEAL - T_STACK, kind: 'stack', drift: 0.03, plates },
      { at: T_REVEAL, dur: T_HERO - T_REVEAL, scene: 'revealLabel' },
      { at: T_HERO, dur: T_BLACK - T_HERO, scene: 'revealHero' },
      { at: T_BLACK, dur: END - T_BLACK, kind: 'black' },
    ],
  };

  // the bottle PNG: 1927 x 2412, glass from y 124 (cap) to 2176 (base); label around y 1150-1950
  const B = { w: 1987, h: 2472, top: 157, base: 2203 };
  const at = (frac, h, cy) => cy - h / 2 + frac * h;        // y of a point at `frac` down the PNG, for a PNG of height h centred at cy

  window.SCENES = {
    // 1. the neck in a sliver of hard light, black around it, slow creep down
    macroNeck(g, s) {
      g.background('#120f0e', 0);
      const h = g.lerp(3.3, 3.45, s.p), cy = g.lerp(1.12, 1.06, g.ease.inOut(s.p)), x = 0.05;
      g.image('bottle', x, cy, h, { bright: 0.35, contrast: 1.6 });
      // a sliver of hard light: a narrow band clipped to the glass, low intensity
      // hard light running down both edges of the neck (the glass spans about p 0.44-0.56 of the sweep range)
      g.sweep('bottle', x, cy, h, g.lerp(0.469, 0.473, s.p), { amt: 0.8, width: 0.006, slant: 0 });
      g.sweep('bottle', x, cy, h, g.lerp(0.529, 0.525, g.clamp(s.p * 1.2 - 0.1)), { amt: 0.8, width: 0.006, slant: 0 });
      g.sweep('bottle', x, cy, h, g.lerp(0.47, 0.472, s.p), { amt: 0.85, width: 0.0015, slant: 0 });
      g.pool(x, cy - h * 0.1, 0.9, 1.0, 'rgba(18,15,14,1)', 0.0);
      g.pool(x + 0.12, -0.35, 0.09, 0.7, 'rgba(255,226,196,1)', 0.05, 0.08, 0.95);
      g.dust(s.f, 26, 'rgba(255,244,226,.5)', 4);
    },
    // 2. top-down spotlight pool on a grained floor, the bottle's long shadow across it
    macroPool(g, s) {
      g.background('#121010', 0);
      const sx = g.lerp(0.03, -0.03, s.p), px = sx + 0.02, py = 0.04;
      g.pool(px, py, 0.62, 0.38, 'rgba(220,204,180,1)', 0.65, -0.12, 0.8);
      const r = g.rng(77), c = g.ctx; c.save(); c.fillStyle = 'rgba(30,26,22,.45)';
      for (let i = 0; i < 6000; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()); c.fillRect(g.sx(px + Math.cos(a) * d * 0.6), g.sy(py + Math.sin(a) * d * 0.36), 1 + r() * 2.5, 1 + r() * 2); }
      c.restore();
      // the bottle stands at the back of the pool; its shadow falls toward the camera, long and flat
      const bx = sx + 0.18, base = 0.1, bh = 0.62;
      c.save(); c.translate(g.sx(bx), g.sy(base)); c.transform(1, 0, 0.9, -0.55, 0, 0);
      c.translate(-g.sx(bx), -g.sy(base));
      g.image('bottle', bx, base, bh, { bright: 0, alpha: 0.7, blur: 3, ax: 0.5, ay: B.base / B.h });
      c.restore();
      g.pool(bx, base, 0.07, 0.012, 'rgba(10,8,7,1)', 0.8);
      g.image('bottle', bx, base, bh, { bright: 0.5, ax: 0.5, ay: B.base / B.h });
      g.dust(s.f, 20, 'rgba(255,248,232,.5)', 8);
    },
    // 3. close on the label, a warm band of light sweeping across it
    macroLabel(g, s) {
      g.background('#120f0e', 0);
      const h = g.lerp(2.45, 2.6, s.p), cy = -0.08 + h * (0.5 - 1560 / B.h);
      g.image('bottle', -0.02, cy, h, { bright: 0.7 });
      g.sweep('bottle', -0.02, cy, h, g.lerp(0.15, 0.9, g.ease.inOut(s.p)), { amt: 0.8, width: 0.12 });
      g.dust(s.f, 18, 'rgba(255,240,220,.45)', 12);
    },
    // 4. reveal: label close-up in the curtain light
    revealLabel(g, s) {
      g.background('#161312', 0);
      g.curtain(s.t, { x0: -0.55, x1: 0.55, top: -0.6, bottom: 0.6, amt: 3.2, folds: 6, gaps: true, light: [242, 210, 176] });
      g.pool(0, -0.15, 0.6, 0.7, 'rgba(242,200,170,1)', 0.3);
      const h = g.lerp(2.0, 2.12, s.p), cy = 0.02 + h * (0.5 - 1450 / B.h);
      g.image('bottle', 0.0, cy, h, { bright: g.lerp(0.75, 0.95, s.p) });
      g.sweep('bottle', 0.0, cy, h, g.lerp(0.2, 0.75, s.p), { amt: 0.5 });
    },
    // 5. the hero shot: bottle on a glossy floor, the curtain, the title builds
    revealHero(g, s) {
      g.background('#161312', 0);
      g.curtain(s.t, { x0: -0.42, x1: 0.45, top: -0.62, bottom: 0.24, amt: 1.6, folds: 5, light: [242, 210, 176] });   // soft drape underneath
      g.curtain(s.t, { x0: -0.42, x1: 0.45, top: -0.62, bottom: 0.24, amt: 1.5, folds: 6, gaps: true, light: [242, 210, 176] });   // fold highlights
      // the floor plane: dark and glossy from the horizon down, full width; its pools and the reflection go on top
      { const c = g.ctx, fg = c.createLinearGradient(0, g.sy(0.23), 0, g.sy(0.5)); fg.addColorStop(0, 'rgba(30,25,22,0.75)'); fg.addColorStop(0.15, 'rgba(24,21,19,0.95)'); fg.addColorStop(1, 'rgba(18,16,15,1)'); c.fillStyle = fg; c.fillRect(0, g.sy(0.23), g.W, g.H); }
      const floor = 0.3, bh = 0.74 * (B.h / (B.base - B.top)), bx = -0.34, push = g.lerp(1, 1.035, s.p);
      const c = g.ctx; c.save(); c.translate(g.W / 2, g.H / 2); c.scale(push, push); c.translate(-g.W / 2, -g.H / 2);
      const cy = floor - bh / 2 + (1 - B.base / B.h) * bh;   // base of the glass on the floor
      g.pool(bx, floor + 0.06, 0.6, 0.12, 'rgba(242,210,176,1)', 0.25, 0, 0.8);
      g.pool(bx, floor + 0.04, 0.3, 0.12, 'rgba(255,226,196,1)', 0.35, 0, 0.8);
      // mirrored about the floor line: draw it where the bottle is (centre cy), so its base meets the glass base
      g.reflect('bottle', bx, floor, bh, { alpha: 0.42, blur: 2, dy: (1 - B.base / B.h) * bh });
      g.pool(bx, floor, 0.07, 0.012, 'rgba(10,8,7,1)', 0.8);
      g.image('bottle', bx, cy, bh, { bright: 0.92 });
      g.sweep('bottle', bx, cy, bh, 0.62 + 0.04 * Math.sin(s.t * 0.8), { amt: 0.25 });
      c.restore();
      // title: "The / Golden / Brewery" builds in the first 0.8 s, "since 1873" on its line, script on its line
      const tSince = L.find((l) => l[2].startsWith('Since'))[0] - T_HERO, tName = L.find((l) => l[2] === 'Adolph Coors.')[0] - T_HERO, tTitle = L.find((l) => l[2] === 'The Golden Brewery.')[0] - T_HERO;
      const w = (k) => g.clamp((s.t - tTitle - k) / 0.08);   // The / Golden / Brewery build on the spoken line
      const reveal = w(0) + w(0.3) + w(0.65) + g.clamp((s.t - tSince) / 0.3);
      g.title([{ text: 'The', size: 0.07, gap: 0.07 }, { text: 'Golden', size: 0.16, gap: 0.15 }, { text: 'Brewery', size: 0.15, gap: 0.14 },
        { text: 'since 1873', size: 0.055, gap: 0.08 }], 0.27, -0.33, { reveal, bevel: 0.009 });
      const sp = g.clamp((s.t - tName) / 0.9);
      if (sp > 0) g.script('Adolph Coors', 0.29, 0.25, 0.085, { chars: 12 * sp + 0.5, alpha: g.clamp(sp * 3) });
    },
  };
})();
