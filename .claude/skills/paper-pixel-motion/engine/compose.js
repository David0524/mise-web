/* paper-pixel-motion · composer
 * Builds film shots from a planned spec (engine/plan.js). Load after ppm.js, sprites.js, flow.js, grid-sprites.js, plan.js.
 *
 *   const film = await PPMCompose.build(canvas, spec, words?)   // words = faster-whisper JSON (optional)
 *   film.plan  → the plan (beats, warnings) ; window.film = film; window.ready = true
 *
 * Every beat type has one builder. Builders read only the beat + the spec, so the whole film is data.
 * A beat may override any builder default with its own fields (documented in references/spec.md).
 */
(function () {
  'use strict';
  const E = PPM.ease, C = PPM.C;
  const tokens = (s) => String(s || '').split(/\s+/).filter(Boolean);

  // ───────────── shared helpers ─────────────
  /** Visible text at time t from the beat's reveal list (flow: types each word over ~.22s). */
  function typedAt(b, t) {
    let s = '';
    for (const r of b.reveal || []) {
      if (t < r.t) break;
      const word = tokens(b.text)[b.reveal.indexOf(r)], k = Math.min(1, (t - r.t) / .22);
      s += (s ? ' ' : '') + word.slice(0, Math.ceil(word.length * k));
    }
    return s;
  }
  function revealTimes(b) { return (b.reveal || []).map(r => r.t); }
  const keyIndex = (b) => b.key ? tokens(b.text).findIndex(w => w.toLowerCase().replace(/[^a-z']/g, '').startsWith(b.key.toLowerCase())) : -1;

  function obj(g, ctx, name, x, y, size, o = {}) { // flat sprite in cut mode, 3D block in flow mode
    return ctx.flow ? g.block(name, x, y, size, o) : g.sprite(name, x, y, size, o);
  }
  /** Sentence line on the centre: cut = word-by-word left-aligned; flow = typed + centred. Returns layout. */
  function line(g, ctx, b, t, o = {}) {
    const size = o.size || 52, color = o.color || C.ink, words = tokens(b.text), hi = {};
    const ki = keyIndex(b); if (ki >= 0 && o.highlightKey) hi[ki] = o.highlightKey;
    if (ctx.flow) {
      const shown = typedAt(b, t), r = g.caption(shown, o.x ?? 720, o.y ?? 540, { size, color, cursorColor: o.cursorColor || color, align: o.align || 'center', t, blink: t > (b.reveal?.at(-1)?.t ?? 0) + .4 });
      if (ki >= 0 && shown.split(' ').length > ki) { const pre = words.slice(0, ki).join(' ') + (ki ? ' ' : ''); g.underline(r.x0 + g.measure(pre, size), (o.y ?? 540) + size * .62, g.measure(words[ki], size), (t - b.reveal[ki].t) / .35); }
      return r;
    }
    const r = g.words(words, revealTimes(b), t, o.x ?? 40, o.y ?? 540, { size, color, highlight: Object.keys(hi).length ? hi : o.highlight });
    if (ki >= 0 && t > b.reveal[ki].t && o.underline !== false) { const p = r.positions[ki]; g.underline(p.x, (o.y ?? 540) + size * .62, p.w, (t - b.reveal[ki].t) / .3); }
    return r;
  }

  // ───────────── builders ─────────────
  const B = {
    hero(g, s, b, ctx) {
      const word = tokens(b.text)[0];
      if (ctx.flow) { // shot world is paper; the yellow card wipes off to the left
        const wipe = E.inOut((s.t - s.d * .2) / (s.d * .8));
        g.layer({ x: -wipe * 1500 }, () => { g.ctx.fillStyle = C.yellowFlash; g.ctx.fillRect(0, 0, 1440, 1080); g.text(word, 720, 600, { size: 350, weight: 700, align: 'center', track: -.04, baseline: 'alphabetic', color: C.ink }); g.guides([110, 1000]); });
        return;
      }
      const flashEnd = Math.min(4 / 24, s.d * .3);
      if (s.t < flashEnd) { g.text(word, 720, 600, { size: 350, weight: 700, align: 'center', track: -.04, baseline: 'alphabetic', color: C.ink }); g.guides([110, 1000]); return; }
      g.bg('paper');
      const u = s.t - flashEnd, rest = s.d - flashEnd;
      if (u < 2 / 24) { g.sketchText(word, 720, 620, 350, s.F, { passes: 10 }); return; }
      const wipe = (u - rest * .45) / (rest * .3), x = 720 - Math.max(0, wipe) * 90;
      g.text(word, x, 600, { size: 350, weight: 700, align: 'center', track: -.04, baseline: 'alphabetic' });
      g.guides([605], { alpha: .8 });
      g.stroke([[x - 160, 650], [x - 150, 690], [x + 220, 680], [x + 460, 660]], (u - 2 / 24) / .15, { width: 2.6 });
      if (wipe > 0) g.blockWipe(x - 120, 340, 1600, 300, wipe * 1.2);
    },
    sentence(g, s, b, ctx) {
      if (!ctx.flow && b.reveal?.length && s.t < b.reveal[0].t) { // lead-in: the whole line arrives as a smeared, out-of-focus bar
        const k = 1 - g.clamp((b.reveal[0].t - s.t) / Math.max(.05, b.reveal[0].t));
        g.layer({ blur: 9 - k * 6, alpha: .35 + k * .3 }, () => g.motionBlur(60, 0, () => g.words(tokens(b.text), tokens(b.text).map(() => 0), 1, 40, 540, { size: 52 }), 5));
        return;
      }
      const r = line(g, ctx, b, s.t, { highlightKey: null });
      if (!ctx.flow && r.positions) { // a pen scribble writing under the newest word, on twos
        const k = Math.max(0, revealTimes(b).filter(t => t <= s.t).length - 1), a = r.positions[k], since = s.t - b.reveal[k].t;
        if (since >= 0) g.stroke(g.scribblePath(['zigzag', 'signature', 'hook', 'underline'][k % 4], a.x + 20, 610, 120, 110, k + b.i * 7), since / .24, { width: 2.5 });
        g.flecks(2, 77 + b.i, s.f);
      }
    },
    flare(g, s, b, ctx) {
      const pool = E.inOut((s.t - s.d * .55) / (s.d * .4)), sweep = ctx.flow ? E.inOut(s.t / .6) : 1;
      g.ditherStar(-40 - (1 - sweep) * 500, 540, 700, 900, .05 + s.t * .03, s.F, { colors: ['#2E5BFF', '#32B9E1'], density: .8, base: .9, rim: '#45E0F0', rimBlur: 18, k: 1.25 });
      (b.objects || ctx.objects.slice(0, 4)).forEach((n, i) => obj(g, ctx, n, [900, 1180, 1090, 1260][i % 4] + Math.sin(s.t * 2 + i) * 6, [310, 300, 640, 830][i % 4] + Math.cos(s.t * 1.7 + i) * 5, 90, { rot: Math.sin(s.t + i) * .35, shadow: false }));
      if (pool > 0) g.lightPool(1040 + pool * 80, 560, 620 - pool * 160, 520 - pool * 120, .2 + pool * .75);
      if (b.text) line(g, ctx, b, s.t, { highlight: pool > .5 && keyIndex(b) >= 0 ? { [keyIndex(b)]: C.white } : null, underline: false });
    },
    silhouette(g, s, b, ctx) {
      const shp = ctx.shapes[b.shape], isHand = shp.kind === 'hand', heat = E.out(s.t / .45), rise = isHand ? E.out(s.t / .45) : 1;
      const hot = b.hotspot || (isHand ? [760, 980, 150] : [1090, 940, 115, 170]);
      const ring = b.orbit ? g.clamp((s.t - .5) / .7) : 0, [ox, oy] = isHand ? [760, 560] : [1010, 430];
      if (ring > 0 && ring < 1) g.orbit(ox, oy, 340, 110, -.5, ring, 'back');
      g.layer({ blur: (1 - heat) * 24 }, () => g.heat(shp.src, { key: b.shape, t: s.T, heat, offset: { x: 0, y: (1 - rise) * 300 }, hotspot: hot, hotspotStrength: isHand ? .3 : .65 }));
      if (ring > 0 && ring < 1) g.orbit(ox, oy, 340, 110, -.5, ring, 'front');
      const words = tokens(b.text);
      if (isHand) { // split the line either side of the hand; shrink to fit (40 px floor) so neither half leaves the frame
        const half = Math.ceil(words.length / 2), L = { ...b, text: words.slice(0, half).join(' '), reveal: b.reveal.slice(0, half) }, R = { ...b, text: words.slice(half).join(' '), reveal: b.reveal.slice(half) };
        const fs = Math.max(40, Math.min(52, 52 * (440 - 58) / Math.max(1, g.measure(L.text, 52)), 52 * (1382 - 1010) / Math.max(1, g.measure(R.text, 52) + 40)));
        const lx = Math.max(58, 440 - g.measure(L.text, fs));
        if (ctx.flow) { const onR = R.reveal.length && s.t >= R.reveal[0].t; g.caption(typedAt(L, s.t), lx, 520, { size: fs, color: C.white, cursorColor: C.white, align: 'left', cursor: !onR, t: s.t }); g.caption(typedAt(R, s.t), 1010, 520, { size: fs, color: C.white, cursorColor: C.white, align: 'left', cursor: onR, t: s.t }); }
        else { g.words(tokens(L.text), revealTimes(L), s.t, lx, 520, { size: fs, color: C.white }); g.words(tokens(R.text), revealTimes(R), s.t, 1010, 520, { size: fs, color: C.white }); }
      } else line(g, ctx, b, s.t, { x: ctx.flow ? 110 : 130, align: 'left', color: C.white, cursorColor: C.white });
      const wash = !ctx.flow && b.wash !== false ? g.clamp((s.t - (s.d - .35)) / .3) : 0;
      if (wash > 0) { g.ctx.fillStyle = `rgba(110,92,92,${wash * .75})`; g.ctx.fillRect(0, 0, 1440, 1080); if (wash > .6 && !isHand) g.cutout(shp.src); }
    },
    ring(g, s, b, ctx) {
      const names = b.objects || ctx.objects, rot = s.T * .35, heroes = new Set(ctx.spec.beats.filter(x => x.type === 'card').map(x => x.object));
      const free = names.map((n, i) => i).filter(i => !heroes.has(names[i])), hits = b.hits || (ctx.flow ? [] : [[.45, free[2 % free.length]], [1.0, free[Math.min(free.length - 1, 7)]]]);
      if (ctx.flow) { g.ring(names, 720, 560, 420, { size: 220, spin: rot, t: s.T }); return; }
      g.carousel(names, 720, 540, 400, 260, rot, { size: 250, back: .8, front: 1.3, per: (i) => ({ opts: { silhouette: hits.some(([t, j]) => j === i && s.t > t + .12) ? 1 : 0 } }) });
      hits.forEach(([t, j], k) => {
        const a = rot + (j / names.length) * Math.PI * 2, x = 720 + Math.cos(a) * 400, y = 540 + Math.sin(a) * 260, lp = (s.t - t) / .18;
        if (lp > -1 && lp < 0) g.brushSmear([[x - 180, y - 260], [x - 60, y - 120], [x, y]], 1 + lp, { width: 30, core: 6 });
        if (lp >= 0 && lp < 1.4) g.sprayBlot(x, y, 70, Math.min(1, lp), 30 + k);
        if (lp >= .3 && lp < .55) g.splatter(x, y, 120, 4 + k);
      });
      g.flecks(5, 31 + b.i, s.f);
    },
    card(g, s, b, ctx) {
      const word = b.text, accent = b.accent || 'sparkle';
      if (ctx.flow) { // the page floods from the object; the word types inside the flood
        const nextW = ctx.plan.beats[ctx.plan.beats.indexOf(b) + 1]?.world, drain = nextW === 'void' ? 0 : g.clamp((s.t - s.d * .72) / (s.d * .26));
        const fl = g.clamp((s.t - s.d * .05) / (s.d * .3)) * (1 - drain); // proportional; stays flooded when the next beat is on void
        g.flood(400, 520, fl, C.void);
        g.inFlood(400, 520, fl, () => { accentFx(g, s, accent, 400, 520, 380); g.caption(typedAt(b, s.t), 820, 520, { size: 80, weight: 600, color: C.white, cursorColor: C.white, t: s.t, soft: false }); });
        g.block(b.object, 400, 520, 380, { shadowAlpha: .28 * (1 - fl) });
        return;
      }
      const inK = E.out(s.t / .2);
      g.ditherStar(1020, 520, 380, 520, 0, s.F, { colors: ['#2a0c0e', '#8a1a1a'], density: .3, base: .5, alpha: 1 - inK * .8 });
      accentFx(g, s, accent, 400, 520, 380);
      g.layer({ blur: (1 - inK) * 10 }, () => g.sprite(b.object, 400, 520, 380, { rot: -.12 }));
      if (accent === 'sparkle') g.sparkle(400 + 160, 520 - 160, 110 * E.back(s.t / .2), { rot: .3 + s.t * .3, ax: 1.2, ay: .8, k: 1.9, glow: 22 });
      const tw = g.text(word, 820, 520, { size: 80, weight: 600, color: C.white, glow: 'rgba(255,240,230,.4)', alpha: s.t > .1 ? 1 : 0 });
      g.cursor(820 + tw + 90, 520, 80, s.t, s.t < .25 ? 'block' : 'bar');
      if (s.t > .1 && s.t < .18) { g.ctx.fillStyle = C.white; g.ctx.fillRect(820 + tw * .7, 474, tw * .5, 92); }
    },
    conveyor(g, s, b, ctx) {
      const names = b.objects || ctx.objects, off = s.t * 1400;
      names.forEach((n, i) => g.motionBlur(-26, 0, () => obj(g, ctx, n, 1100 - off + i * 200 - (b.i % 3) * 300, 540, ctx.flow ? 200 : 330, { rot: i % 2 ? .04 : -.04, shadow: false }), 5));
      g.streaks(10, b.i, s.f, { alpha: 1 });
    },
    scatter(g, s, b, ctx) {
      const names = b.objects || ctx.objects, k = E.inOut((s.t - .2) / .6), r = PPM.rng(5 + b.i);
      names.forEach((n, i) => {
        const a = .4 + (i / names.length) * Math.PI * 2, x0 = 720 + Math.cos(a) * 400, y0 = 540 + Math.sin(a) * 260, x1 = r.range(120, 1320), y1 = r.range(120, 960);
        const x = g.lerp(x0, x1, k), y = g.lerp(y0, y1, k), ink = i % 3 === 0 ? g.clamp((s.t - .9 - i * .02) / .15) : 0;
        if (ctx.flow) g.block(n, x, y, g.lerp(120, 130, k), { rot: g.lerp(0, r.range(-.6, .6), k), ink });
        else { g.sprite(n, x, y, g.lerp(150, 130, k), { rot: g.lerp(0, r.range(-.6, .6), k), silhouette: ink }); if (ink > 0 && ink < 1) g.sprayBlot(x, y, 60, ink * 1.2, i); }
      });
      if (s.t > .25 && s.t < .85) { const p = (s.t - .25) / .6; g.brushSmear([[200, 300], [380, 200], [300, 420], [520, 520], [700, 380]], p * 1.4, { p0: Math.max(0, p - .3), width: 30, core: 5 }); }
      if (ctx.flow) { const sw = E.inOut((s.t - (s.d - .8)) / .7); [[260, 220, 1], [1150, 300, 2], [700, 820, 3], [300, 820, 4], [1180, 860, 5], [720, 480, 6]].forEach(([x, y, q], j) => g.sprayBlot(x, y, 420, g.clamp(sw * 1.3 - j * .06), q, { hard: true })); const full = g.clamp((s.t - (s.d - .22)) / .2); if (full > 0) { g.ctx.fillStyle = `rgba(20,20,20,${full})`; g.ctx.fillRect(0, 0, 1440, 1080); } }
      g.flecks(8, 51 + b.i, s.f);
    },
    spell(g, s, b, ctx) {
      const L = b.letters, k = b.letterIndex, n = L.length, xs = L.map((_, j) => 90 + j * (1260 / Math.max(1, n - 1)));
      const ink = b.world === 'paper' ? C.ink : C.white, slots = b.objects || ctx.objects;
      for (let j = 0; j <= k; j++) g.text(L[j], xs[j], 540, { size: 64, weight: 600, color: ink, align: 'center' });
      const sx = k < n - 1 ? (xs[k] + xs[k + 1]) / 2 : (xs[Math.max(0, k - 2)] + xs[Math.max(1, k - 1)]) / 2;
      if (b.world === 'void') g.glow(sx, 540, 230, '#C41E14', .9);
      if (ctx.flow && k > 0) g.morph(slots[(k - 1) % slots.length], slots[k % slots.length], E.inOut(s.t / (s.d * .9)), sx, 540, 220, { shadow: b.world === 'paper' });
      else obj(g, ctx, slots[k % slots.length], sx, 540, 220, { shadow: b.world === 'paper' });
    },
    resolve(g, s, b, ctx) {
      const word = String(b.text).replace(/\s/g, '').toUpperCase(), r = PPM.rng(44 + b.i);
      const Ls = [...word].map((ch, i) => ({ ch, x: r.range(250, 1200), y: r.range(200, 900), a: r.range(-2.4, 2.4) }));
      if (s.t < .4) [[[60, 200], [250, 120], [200, 380], [420, 440]], [[700, 200], [950, 250], [1100, 420], [980, 520]], [[600, 900], [800, 720], [1100, 820], [1300, 700]]].forEach(pts => g.brushSmear(pts, s.t / .25 * 1.3, { p0: Math.max(0, s.t / .25 - .4), width: ctx.flow ? 14 : 60, core: ctx.flow ? 2.5 : 5 }));
      const end = b.end || (b.object ? 'word' : 'knot'), c0 = end === 'word' ? s.d * .3 : s.d - 1.0, c1 = end === 'word' ? s.d * .65 : s.d - .4;
      const conv = E.inOut(g.clamp((s.t - c0) / (c1 - c0))), loopFade = end === 'word' ? 1 - g.clamp((s.t - c1) / .3) : 1; // word: settle by 65 %, then hold clean
      Ls.forEach((l, i) => {
        const drift = Math.sin(s.t * .9 + i) * 20, settle = E.out(g.clamp((s.t - .3) / 1.2));
        const tx = end === 'word' ? 720 + (i - (Ls.length - 1) / 2) * 90 : 720 + (i - (Ls.length - 1) / 2) * 18;
        const x = g.lerp(l.x + drift, tx, conv), y = g.lerp(l.y, 540, conv), a = g.lerp(l.a * (1 - settle * .8), 0, conv);
        g.layer({ x, y, rot: a, alpha: end === 'knot' ? 1 - g.clamp((conv - .6) / .4) : 1 }, () => g.text(l.ch, 0, 0, { size: 56, weight: 600, align: 'center' }));
        if (s.t > .9 && loopFade > 0) g.layer({ alpha: loopFade }, () => g.redLoops(x, y, end === 'word' ? 40 + (1 - conv) * 30 : 40 + conv * 60, s.f, i + 1, { loops: s.t > 1.5 ? 2 : 1 }));
      });
      if (end === 'knot' && conv > .4) { const kr = PPM.rng(90 + g.stepped(s.f, 2)), grow = g.clamp((conv - .4) / .45); for (let j = 0; j < 4; j++) { const pts = []; for (let q = 0; q < 6; q++) pts.push([720 + kr.range(-80, 80), 540 + kr.range(-70, 70)]); g.stroke(pts, grow, { width: g.lerp(10, 22, grow), taper: false }); } }
      if (end === 'word' && b.object) obj(g, ctx, b.object, 720, 330 - (1 - conv) * 60, 200, {});
    },
    flash(g, s, b) { if (b.text) g.text(tokens(b.text)[0], 720, 540, { size: 120, weight: 700, align: 'center', color: C.ink }); },
  };
  function accentFx(g, s, accent, x, y, size) {
    if (accent === 'beam') { g.beam(x - 100, y + 80, -0.62, 1400, 160, 300, (s.t - .1) / .15, '#E2261A'); g.beam(x - 80, y + 120, 2.45, 900, 50, 160, (s.t - .1) / .15, '#E2261A'); }
    if (accent === 'notes') [['notes2', x + 230, y - 230, .2], ['note', x + 400, y + 260, .35], ['note', x + 120, y + 330, .5]].forEach(([n, nx, ny, t0], i) => { if (s.t > t0) g.sprite(n, nx, ny + Math.sin(s.t * 3 + i) * 8, i ? 120 : 150, { rot: Math.sin(s.t * 2 + i) * .15 }); });
    if (accent === 'scribble' && s.t < .25) g.stroke(g.scribblePath('zigzag', x + 130, y - 140, 260, 380, 3), s.t / .12, { color: C.white, width: 3 });
    if (accent === 'orbits') { g.orbit(x, y, 230, 80, -.3, g.clamp((s.t - .2) / .8), 'front', { len: 2.4 }); g.orbit(x, y, 260, 90, .5, g.clamp((s.t - .35) / .8), 'front', { len: 2.4 }); }
  }

  /** Resolve spec.silhouettes → { key: { src: shapeFn|maskCanvas, kind } }. "shape:profile", "shape:hand", "mask:<url>". */
  async function loadShapes(spec) {
    const out = {};
    for (const [k, v] of Object.entries(spec.silhouettes || {})) {
      const [kind, arg] = String(v).split(':');
      if (kind === 'shape') out[k] = { src: arg === 'hand' ? PPM.SHAPES.hand(760, 1130, 1.05, .95) : PPM.SHAPES.profile(980, 190, 1.05), kind: arg };
      else if (kind === 'mask') { const m = await PPM.loadMask(v.slice(5)); const isHand = /hand/i.test(k); out[k] = { src: PPM.placeMask(m, isHand ? { x: 760, y: 760, h: 900 } : { x: 1000, y: 640, h: 980 }), kind: isHand ? 'hand' : 'head' }; }
    }
    return out;
  }

  async function build(canvas, spec, words) {
    const plan = PPMPlan.plan(spec, words);
    if (plan.errors.length) throw new Error('spec errors:\n' + plan.errors.join('\n'));
    const flow = plan.mode === 'flow';
    const film = PPM.film(canvas, { w: spec.size?.[0] || 1440, h: spec.size?.[1] || 1080, fps: +(new URLSearchParams(location.search).get('fps') || plan.fps), font: spec.font || (flow ? 'Geist' : 'Outfit'),
      camera: flow ? { float: 7, rot: .35, push: .04 } : { float: 0, push: 0 } });
    const ctx = { spec, plan, flow, objects: spec.objects?.length ? spec.objects : PPM.KITCHEN_SET, shapes: await loadShapes(spec) };
    plan.beats.forEach((b, k) => {
      const fn = B[b.type], orig = spec.beats[b.i] || {};
      if (flow && b.type === 'card' && !orig.world) b.world = 'paper'; // flow cards flood void out of the object over the page
      if (flow && b.type === 'hero' && !orig.world) b.world = 'paper'; // the yellow card is drawn in-shot and wipes off to reveal paper
      film.shot(b.dur, b.world, (g, s) => {
        const HO = Math.min(.18, b.dur * .25);
        if (flow && k > 0 && plan.beats[k - 1].transition === 'handoff' && s.t < HO) { // continuous handoff: start on the outgoing shot's last frame, then cross to this one
          g.under(k - 1, plan.beats[k - 1].dur - 1e-3); g.ctx.save(); g.ctx.globalAlpha = E.inOut(s.t / HO); g.bg(b.world); g.ctx.restore();
          g.ctx.globalAlpha = E.inOut(s.t / HO);
        }
        fn(g, s, b, ctx);
      }, { push: b.push, vignette: b.type === 'hero' || b.type === 'flash' ? .25 : undefined });
    });
    film.plan = plan;
    return film;
  }

  window.PPMCompose = { build, builders: B, typedAt };
})();
