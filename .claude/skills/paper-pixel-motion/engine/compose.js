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
  /** Frame layout in 1080p units: W×H, centre, orientation, and the card's object anchor. */
  function LY(g) { const W = g.W / g.U, H = g.H / g.U, portrait = H > W * 1.05; return { W, H, cx: W / 2, cy: H / 2, portrait, sx: W / 1440, sy: H / 1080, card: portrait ? [W / 2, H / 2 - 250] : [400, 520] }; }
  const scalePts = (pts, L) => pts.map(([x, y]) => [x * L.sx, y * L.sy]);
  /** Split a line into two balanced halves when it won't fit across the frame. */
  function wrap2(g, text, size, maxW) {
    const w = tokens(text); if (w.length < 2 || g.measure(text, size) <= maxW) return [w];
    let best = 1, bd = 1e9; for (let k = 1; k < w.length; k++) { const d = Math.abs(g.measure(w.slice(0, k).join(' '), size) - g.measure(w.slice(k).join(' '), size)); if (d < bd) { bd = d; best = k; } }
    return [w.slice(0, best), w.slice(best)];
  }
  /** Sentence line on the centre: cut = word-by-word left-aligned; flow = typed + centred. Returns layout. */
  function line(g, ctx, b, t, o = {}) {
    const size = o.size || (LY(g).portrait ? 62 : 52), color = o.color || (DARK.has(b.world) ? C.white : C.ink), words = tokens(b.text), hi = {}; // phones: a touch bigger, wraps to two lines
    const ki = keyIndex(b); if (ki >= 0 && o.highlightKey) hi[ki] = o.highlightKey;
    if (ctx.flow) {
      const Lo = LY(g), X = o.x ?? Lo.cx, Y = o.y ?? Lo.cy, lead = Math.min(.15, b.reveal?.[0]?.t ?? 0), shownAll = typedAt(b, t + lead), blink = t > (b.reveal?.at(-1)?.t ?? 0) + .4;
      const lines = o.align === 'left' ? [words] : wrap2(g, b.text, size, Lo.W - 140), nShown = shownAll ? shownAll.split(' ').length : 0;
      let used = 0, r = null;
      lines.forEach((lw, li) => {
        const yy = Y + (li - (lines.length - 1) / 2) * size * 1.35, part = shownAll.split(' ').slice(used, used + lw.length).join(' '), active = nShown > used && (nShown <= used + lw.length || li === lines.length - 1);
        if (part || li === 0) {
          const rr = g.caption(part, X, yy, { full: lw.join(' '), size, color, cursorColor: o.cursorColor || color, align: o.align || 'center', t, blink, cursor: lines.length === 1 || active || (li === 0 && !nShown) });
          const kk = ki - used; if (o.underline !== false && kk >= 0 && kk < lw.length && nShown > ki) { const pre = lw.slice(0, kk).join(' ') + (kk ? ' ' : ''); g.underline(rr.x0 + g.measure(pre, size), yy + size * .62, g.measure(lw[kk], size), (t - b.reveal[ki].t) / .35); }
          r = r || rr;
        }
        used += lw.length;
      });
      return r;
    }
    const r = g.words(words, revealTimes(b), t, o.x ?? 40, o.y ?? 540, { size, color, highlight: Object.keys(hi).length ? hi : o.highlight });
    if (ki >= 0 && t > b.reveal[ki].t && o.underline !== false) { const p = r.positions[ki]; g.underline(p.x, (o.y ?? 540) + size * .62, p.w, (t - b.reveal[ki].t) / .3); }
    return r;
  }

  const DARK = new Set(['void', 'red', 'wash']); // worlds that take white type
  /** Mosaic schedule for "waking up" objects: coarse → fine over the first ~.6 s, with one relapse. 0 = full detail. */
  const mosaicAt = (t, i = 0) => { const u = t - i * .04; return u < .12 ? 4 : u < .22 ? 6 : u < .3 ? 8 : u < .42 ? 0 : u < .48 ? 6 : u < .56 ? 10 : 0; };

  // ───────────── builders ─────────────
  const B = {
    hero(g, s, b, ctx) {
      const word = tokens(b.text)[0];
      if (ctx.flow) { // shot world is paper; the yellow card wipes off to the left
        const Lo = LY(g), wipe = E.in(s.t / s.d), hs = Math.min(350, 350 * (Lo.W - 120) / Math.max(1, g.measure(word, 350, 700))); // soft start, leaves the frame exactly at the beat end
        g.layer({ x: -wipe * (Lo.W + 60) * g.U }, () => { g.ctx.fillStyle = C.yellowFlash; g.ctx.fillRect(0, 0, g.W, g.H); g.text(word, Lo.cx * g.U, (Lo.cy + 60) * g.U, { size: hs, weight: 700, align: 'center', track: -.04, baseline: 'alphabetic', color: C.ink }); g.guides([Lo.H * .1 * g.U, Lo.H * .926 * g.U]); });
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
      (b.objects || ctx.objects.slice(0, 4)).forEach((n, i) => obj(g, ctx, n, [900, 1180, 1090, 1260][i % 4] + Math.sin(s.t * 2 + i) * 6, [310, 300, 640, 830][i % 4] + Math.cos(s.t * 1.7 + i) * 5, b.objectSize || 90, { rot: Math.sin(s.t + i) * .35, shadow: false, mosaic: b.mosaic ? mosaicAt(s.t, i) : 0 }));
      if (pool > 0) g.lightPool(1040 + pool * 80, 560, 620 - pool * 160, 520 - pool * 120, .2 + pool * .75);
      if (b.text) line(g, ctx, b, s.t, { x: ctx.flow && !LY(g).portrait ? LY(g).cx + 130 : undefined, highlight: pool > .5 && keyIndex(b) >= 0 ? { [keyIndex(b)]: C.white } : null, underline: false }); // flow: centred right of the flare's reach
    },
    silhouette(g, s, b, ctx) {
      const shp = ctx.shapes[b.shape], isHand = shp.kind === 'hand', heat = E.out(s.t / .45), rise = isHand ? E.out(s.t / .45) : 1;
      const hot = b.hotspot || (isHand ? [760, 980, 150] : [1090, 940, 115, 170]);
      const ring = b.orbit ? g.clamp((s.t - .5) / .7) : 0, [ox, oy] = isHand ? [760, 560] : [1010, 430];
      if (ring > 0 && ring < 1) g.orbit(ox, oy, 340, 110, -.5, ring, 'back');
      const Lo = LY(g);
      if (shp.img) g.layer({ blur: (1 - heat) * 24, alpha: heat, y: (1 - rise) * 300 * g.U, blend: 'screen' }, () => { /* screen: the image's black adds nothing, so the film's void (and grain) stay */
        const iw = shp.img.width, ih = shp.img.height;
        if (Lo.portrait) { const sc = Lo.W * 1.3 / iw * g.U; g.ctx.drawImage(shp.img, (g.W - iw * sc) / 2, g.H - ih * sc, iw * sc, ih * sc); } // portrait: hand rises from the bottom, words above it
        else { const sc = Math.max(g.W / iw, g.H / ih); g.ctx.drawImage(shp.img, (g.W - iw * sc) / 2, (g.H - ih * sc) / 2, iw * sc, ih * sc); } });
      else g.layer({ blur: (1 - heat) * 24 }, () => g.heat(shp.src, { key: b.shape + (b.thick || ''), t: s.T, heat, offset: { x: 0, y: (1 - rise) * 300 }, hotspot: hot, hotspotStrength: b.hotspotStrength ?? (isHand ? .3 : .65), thick: b.thick, glowAlpha: .5 }));
      if (ring > 0 && ring < 1) g.orbit(ox, oy, 340, 110, -.5, ring, 'front');
      const words = tokens(b.text);
      if (isHand && Lo.portrait) { line(g, ctx, b, s.t, { y: Lo.H * .3, size: 56, color: C.white, cursorColor: C.white }); }
      else if (isHand) { // split the line either side of the hand; shrink to fit (40 px floor) so neither half leaves the frame
        const half = Math.ceil(words.length / 2), L = { ...b, text: words.slice(0, half).join(' '), reveal: b.reveal.slice(0, half) }, R = { ...b, text: words.slice(half).join(' '), reveal: b.reveal.slice(half) };
        const LE = b.leftEnd ?? 440, RS = b.rightStart ?? 1010, TY = b.textY ?? 520;
        const fs = Math.max(40, Math.min(52, 52 * (LE - 58) / Math.max(1, g.measure(L.text, 52)), 52 * (1382 - RS) / Math.max(1, g.measure(R.text, 52) + 40)));
        const lx = Math.max(58, LE - g.measure(L.text, fs));
        if (ctx.flow) { const onR = R.reveal.length && s.t >= R.reveal[0].t; g.caption(typedAt(L, s.t), lx, TY, { size: fs, color: C.white, cursorColor: C.white, align: 'left', cursor: !onR, t: s.t }); g.caption(typedAt(R, s.t), RS, TY, { size: fs, color: C.white, cursorColor: C.white, align: 'left', cursor: onR, t: s.t }); }
        else { g.words(tokens(L.text), revealTimes(L), s.t, lx, TY, { size: fs, color: C.white }); g.words(tokens(R.text), revealTimes(R), s.t, RS, TY, { size: fs, color: C.white }); }
      } else line(g, ctx, b, s.t, { x: ctx.flow ? 110 : 130, align: 'left', color: C.white, cursorColor: C.white });
      const wash = !ctx.flow && b.wash !== false ? g.clamp((s.t - (s.d - .35)) / .3) : 0;
      if (wash > 0) { g.ctx.fillStyle = `rgba(110,92,92,${wash * .75})`; g.ctx.fillRect(0, 0, 1440, 1080); if (wash > .6 && !isHand) g.cutout(shp.src); }
    },
    ring(g, s, b, ctx) {
      const names = b.objects || ctx.objects, rot = s.T * .35, heroes = new Set(ctx.spec.beats.filter(x => x.type === 'card').map(x => x.object));
      const free = names.map((n, i) => i).filter(i => !heroes.has(names[i])), hits = b.hits || (ctx.flow ? [] : [[.45, free[2 % free.length]], [1.0, free[Math.min(free.length - 1, 7)]]]);
      if (ctx.flow) { const Lo = LY(g), RR = Math.min(420, Lo.W * .34), U = g.U, fh = b.hits || [], bursts = [];
        // ink hits: the struck object is pulled toward the nib for 3 frames, kicked away (ease out, 2 frames), springs back,
        // flashes hot for 5 frames and carries a soot stain for ~half a second. The burst draws on top of everything.
        const per = (i, p) => { let dx = 0, dy = 0, sz = 1, tint = 0, soot = 0, rot = 0;
          fh.forEach(([t0, j], h) => { if (j !== i) return; const age = (s.t - t0) * 24; if (age < -3 || age > 26) return;
            const dir = [Math.cos(p.a), Math.sin(p.a) * .8], n = Math.hypot(...dir) || 1, ux = dir[0] / n, uy = dir[1] / n;
            if (age < 0) { const pull = E.inOut((age + 3) / 3); dx -= ux * 22 * pull; dy -= uy * 22 * pull; return; }
            const kick = age < 2 ? E.out(age / 2) : E.spring((age - 2) / 24);
            dx += ux * 98 * kick; dy += uy * 72 * kick; sz += .07 * kick; rot += ux * .43 * kick;
            tint = Math.max(tint, Math.max(0, 1 - age / 5) * .83); soot = Math.max(soot, PPM.clamp((age - 3) / 4) * (1 - Math.max(0, age - 11) / 12) * .7);
            if (age < 7) bursts.push([p.x, p.y, age, h + 1]); });
          return { x: p.x + dx * U, y: p.y + dy * U, size: 220 * RR / 420 * sz, opts: { rot: Math.cos(p.a) * .1 + rot, tint: ['#FF7A1A', tint, 'screen'], ink: soot } }; };
        g.ring(names, Lo.cx * U, (Lo.cy + 20) * U, RR, { size: 220 * RR / 420, spin: rot, t: s.T, per: fh.length ? per : undefined });
        fh.forEach(([t0, j], h) => { const age = (s.t - t0) * 24; if (age < -4 || age > 1) return; // the nib: a fast ink stroke diving onto the hit
          const it = bursts.find(q => q[3] === h + 1); const a = s.T * .35 + j / names.length * Math.PI * 2, hx = it ? it[0] : (Lo.cx + Math.cos(a) * RR) * U, hy = it ? it[1] : (Lo.cy + 20 + Math.sin(a) * RR * .38) * U;
          g.brushSmear([[hx - 220 * U, hy - 300 * U], [hx - 90 * U, hy - 140 * U], [hx, hy]], (age + 4) / 4, { p0: Math.max(0, (age + 1) / 3), width: 14, core: 2.5 }); });
        bursts.forEach(([x, y, age, h]) => g.impact(x, y, age, h + b.i * 7));
        return; }
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
        const nextW = ctx.plan.beats[ctx.plan.beats.indexOf(b) + 1]?.world, full = (b.reveal?.at(-1)?.t ?? 0) + .22, d0 = Math.max(s.d * .72, full + .35), carry = shortFlood(b), drain = nextW === 'void' || carry ? 0 : g.clamp((s.t - d0) / Math.max(.12, s.d - d0)); // flood out after a .35s hold; if there's no room, the next shot drains it
        const fl = g.clamp((s.t - s.d * .05) / (s.d * .16)) * (1 - drain); // quick iris: the title must arrive within ~3 frames of the accent // proportional; stays flooded when the next beat is on void
        const Lo = LY(g), [ox, oy] = Lo.card, OS = Lo.portrait ? 420 : 380, U = g.U;
        g.flood(ox * U, oy * U, fl, C.void);
        g.inFlood(ox * U, oy * U, fl, () => { if (b.glow) g.glow(ox * U, oy * U, 330, '#C41E14', .65); accentFx(g, s, accent, ox * U, oy * U, OS, true);
          if (Lo.portrait) g.caption(typedAt(b, s.t), Lo.cx * U, (oy + 520) * U, { full: b.text, align: 'center', size: 96, weight: 600, color: C.white, cursorColor: C.white, t: s.t, soft: false });
          else if (b.title === 'snap') titleSnap(g, { ...s, t: s.t - s.d * .14 }, b, 820, 520, 80); // starts once the flood has covered the title
          else g.caption(typedAt(b, s.t), 820, 520, { size: 80, weight: 600, color: C.white, cursorColor: C.white, t: s.t, soft: false }); });
        g.block(b.object, ox * U, oy * U, OS, { shadowAlpha: .28 * (1 - fl) });
        if (accent === 'sparkle') g.layer({ alpha: fl }, () => g.sparkle((ox + OS * .42) * U, (oy - OS * .42) * U, 110 * E.back(g.clamp((s.t - .15) / .2)), { rot: .3 + s.t * .3, ax: 1.2, ay: .8, k: 1.9, glow: 22 }));
        return;
      }
      const inK = E.out(s.t / .2);
      g.ditherStar(1020, 520, 380, 520, 0, s.F, { colors: ['#2a0c0e', '#8a1a1a'], density: .3, base: .5, alpha: 1 - inK * .8 });
      if (b.glow) g.glow(400, 520, 330, '#C41E14', .65);
      accentFx(g, s, accent, 400, 520, 380);
      g.layer({ blur: (1 - inK) * 10 }, () => g.sprite(b.object, 400, 520, 380, { rot: -.12 }));
      if (accent === 'sparkle') g.sparkle(400 + 160, 520 - 160, 110 * E.back(s.t / .2), { rot: .3 + s.t * .3, ax: 1.2, ay: .8, k: 1.9, glow: 22 });
      const tw = g.text(word, 820, 520, { size: 80, weight: 600, color: C.white, glow: 'rgba(255,240,230,.4)', alpha: s.t > .1 ? 1 : 0 });
      g.cursor(820 + tw + 90, 520, 80, s.t, s.t < .25 ? 'block' : 'bar');
      if (s.t > .1 && s.t < .18) { g.ctx.fillStyle = C.white; g.ctx.fillRect(820 + tw * .7, 474, tw * .5, 92); }
    },
    conveyor(g, s, b, ctx) {
      const names = b.objects || ctx.objects, off = s.t * 1400;
      const Lo = LY(g); names.forEach((n, i) => g.motionBlur(-26, 0, () => obj(g, ctx, n, (Lo.W - 340 - off + i * 200 - (b.i % 3) * 300 * Lo.sx) * g.U, Lo.cy * g.U, ctx.flow ? 200 : 330, { rot: i % 2 ? .04 : -.04, shadow: false }), 5));
      g.streaks(10, b.i, s.f, { alpha: 1 });
    },
    scatter(g, s, b, ctx) {
      const names = b.objects || ctx.objects, k = ctx.flow ? E.expo((s.t - .2) / .42) : E.inOut((s.t - .2) / .6), r = PPM.rng(5 + b.i), Lo = LY(g), U = g.U, drift = ctx.flow ? Math.max(0, s.t - .62) : 0; // flow: a burst that keeps its momentum (drift + tumble), not a tween
      names.forEach((n, i) => {
        const a = .4 + (i / names.length) * Math.PI * 2, pile = b.from === 'pile', pr = PPM.rng(900 + i * 7 + b.i);
        const PR = Math.min(230, Lo.W * .2), x0 = pile ? Lo.cx + pr.range(-PR, PR) : Lo.cx + Math.cos(a) * 400, y0 = pile ? Lo.cy + 60 + pr.range(-150, 130) : Lo.cy + Math.sin(a) * 260, r0 = pile ? pr.range(-1.2, 1.2) : 0, x1 = Lo.portrait ? r.range(Lo.W * .1, Lo.W * .9) : r.range(120, Lo.W - 120), y1 = Lo.portrait ? r.range(Lo.H * .14, Lo.H * .84) : r.range(120, Lo.H - 120); // portrait: keep clear of phone UI at top/bottom
        const da = Math.atan2(y1 - y0, x1 - x0), x = (g.lerp(x0, x1, k) + Math.cos(da) * drift * 45) * U, y = (g.lerp(y0, y1, k) + Math.sin(da) * drift * 32) * U, rot = g.lerp(r0, r.range(-.6, .6), k) + drift * (i - names.length / 2) * .17, ink = i % 3 === 0 ? g.clamp((s.t - .9 - i * .02) / .15) : 0;
        if (ctx.flow) g.block(n, x, y, g.lerp(pile ? 150 : 120, 130, k), { rot, ink });
        else { g.sprite(n, x, y, g.lerp(150, 130, k), { rot, silhouette: ink }); if (ink > 0 && ink < 1) g.sprayBlot(x, y, 60, ink * 1.2, i); }
      });
      if (s.t > .25 && s.t < .85) { const p = (s.t - .25) / .6; g.brushSmear(scalePts([[200, 300], [380, 200], [300, 420], [520, 520], [700, 380]], Lo).map(([x, y]) => [x * U, y * U]), p * 1.4, { p0: Math.max(0, p - .3), width: 30, core: 5 }); }
      if (ctx.flow) { const sw = E.inOut((s.t - (s.d - .8)) / .7); [[260, 220, 1], [1150, 300, 2], [700, 820, 3], [300, 820, 4], [1180, 860, 5], [720, 480, 6]].forEach(([x, y, q], j) => g.sprayBlot(x * Lo.sx * U, (Lo.portrait ? Lo.H * (.14 + .7 * y / 1080) : y * Lo.sy) * U, 420 * Math.max(1, Lo.sy * .85), g.clamp(sw * 1.3 - j * .06), q, { hard: true })); const full = g.clamp((s.t - (s.d - .22)) / .2); if (full > 0) { g.ctx.fillStyle = `rgba(20,20,20,${full})`; g.ctx.fillRect(0, 0, g.W, g.H); } }
      g.flecks(8, 51 + b.i, s.f);
    },
    spell(g, s, b, ctx) {
      const Lo = LY(g), U = g.U, Y = Lo.cy * U, L = b.letters, k = b.letterIndex, n = L.length, xs = L.map((_, j) => (90 + j * ((Lo.W - 180) / Math.max(1, n - 1))) * U), OS = Math.min(220, (Lo.W - 180) / Math.max(1, n - 1) * .5);
      const ink = b.world === 'paper' ? C.ink : C.white, slots = b.objects || ctx.objects;
      for (let j = 0; j <= k; j++) g.text(L[j], xs[j], Y, { size: 64, weight: 600, color: ink, align: 'center' });
      const last = k === n - 1, sx = !last ? (xs[k] + xs[k + 1]) / 2 : Lo.cx * U, sy = last ? Y - 170 * U : Y; // the last object rises above the finished word instead of covering a letter
      if (b.world === 'void') g.glow(sx, sy, 230, '#C41E14', .9);
      if (ctx.flow && k > 0) g.morph(slots[(k - 1) % slots.length], slots[k % slots.length], E.inOut(s.t / (s.d * .9)), sx, sy, OS, { shadow: b.world === 'paper' });
      else obj(g, ctx, slots[k % slots.length], sx, sy, OS, { shadow: b.world === 'paper' });
    },
    resolve(g, s, b, ctx) {
      if (b.end === 'brand' && b.land === 'snap') return brandSnap(g, s, b, ctx);
      const brand = b.end === 'brand', word = brand ? String(b.text).replace(/\s/g, '').toLowerCase() : String(b.text).replace(/\s/g, '').toUpperCase(), r = PPM.rng(44 + b.i);
      const Lo = LY(g), U = g.U, Ls = [...word].map((ch, i) => ({ ch, x: r.range(250, Lo.W - 240), y: r.range(200, Lo.H - 180), a: r.range(-2.4, 2.4) }));
      if (s.t < .4) [[[60, 200], [250, 120], [200, 380], [420, 440]], [[700, 200], [950, 250], [1100, 420], [980, 520]], [[600, 900], [800, 720], [1100, 820], [1300, 700]]].forEach(pts => g.brushSmear(scalePts(pts, Lo).map(([x, y]) => [x * U, y * U]), s.t / .25 * 1.3, { p0: Math.max(0, s.t / .25 - .4), width: ctx.flow ? 14 : 60, core: ctx.flow ? 2.5 : 5 }));
      const end = b.end || (b.object ? 'word' : 'knot'), settleEnd = end === 'brand' ? .45 : .65, c0 = end !== 'knot' ? s.d * (settleEnd - .35) : s.d - 1.0, c1 = end !== 'knot' ? s.d * settleEnd : s.d - .4;
      const conv = E.inOut(g.clamp((s.t - c0) / (c1 - c0))), loopFade = end !== 'knot' ? 1 - g.clamp((s.t - c1) / .3) : 1; // word/brand: settle, then hold clean
      // brand: letters land as the hero-scale lower-case word (bookends the opening hero card)
      const BS = b.size || 300, widths = brand ? [...word].map(ch => g.measure(ch, BS, 700, -.04)) : [], totalW = widths.reduce((a, w) => a + w, 0);
      const brandX = (i) => Lo.cx - totalW / 2 + widths.slice(0, i).reduce((a, w) => a + w, 0) + widths[i] / 2, BY = Lo.cy + (Lo.portrait ? 200 : 110);
      Ls.forEach((l, i) => {
        const drift = Math.sin(s.t * .9 + i) * 20, settle = E.out(g.clamp((s.t - .3) / 1.2));
        const tx = end === 'brand' ? brandX(i) : end === 'word' ? Lo.cx + (i - (Ls.length - 1) / 2) * 90 : Lo.cx + (i - (Ls.length - 1) / 2) * 18;
        const x = g.lerp(l.x + drift, tx, conv) * U, y = g.lerp(l.y, end === 'brand' ? BY : Lo.cy, conv) * U, a = g.lerp(l.a * (1 - settle * .8), 0, conv);
        const sz = end === 'brand' ? g.lerp(56, BS, conv) : 56, wt = end === 'brand' && conv > .5 ? 700 : 600;
        if (!(end === 'brand' && conv >= 1)) g.layer({ x, y, rot: a, alpha: end === 'knot' ? 1 - g.clamp((conv - .6) / .4) : 1 }, () => g.text(l.ch, 0, 0, { size: sz, weight: wt, align: 'center' }));
        if (s.t > .9 && loopFade > 0) g.layer({ alpha: loopFade }, () => g.redLoops(x, y, end === 'word' ? 40 + (1 - conv) * 30 : 40 + conv * 60, s.f, i + 1, { loops: s.t > 1.5 ? 2 : 1 }));
      });
      if (end === 'knot' && conv > .4) { const kr = PPM.rng(90 + g.stepped(s.f, 2)), grow = g.clamp((conv - .4) / .45); for (let j = 0; j < 4; j++) { const pts = []; for (let q = 0; q < 6; q++) pts.push([720 + kr.range(-80, 80), 540 + kr.range(-70, 70)]); g.stroke(pts, grow, { width: g.lerp(10, 22, grow), taper: false }); } }
      if (end === 'word' && b.object) obj(g, ctx, b.object, 720, 330 - (1 - conv) * 60, 200, {});
      if (end === 'brand') {
        if (conv >= 1) { g.text(word, Lo.cx * U, BY * U, { size: BS, weight: 700, align: 'center', track: -.04, color: C.ink }); }
        const gl = g.clamp((s.t - c1) / .35); if (gl > 0) g.guides([(BY + BS * .36) * U], { alpha: .8 * gl, x1: g.W * E.inOut(gl) });
        if (b.object) obj(g, ctx, b.object, Lo.cx * U, (BY - (b.objectLift ?? 380) - (1 - conv) * 60) * U, b.objectSize ?? 200, {});
      }
    },
    flash(g, s, b) { const Lo = LY(g); if (b.text) g.text(tokens(b.text)[0], Lo.cx * g.U, Lo.cy * g.U, { size: 120, weight: 700, align: 'center', color: DARK.has(b.world) ? C.white : C.ink }); },
  };
  /** Brand landing at cut speed: the letters fly and loop, gather in 3 frames onto the word at 2.8× (so the camera
   *  is inside the word), then the camera pulls back to 1× in 4 frames on a snap curve. A tagline (b.tagline) and a
   *  small orange dot rise in after. b.gatherAt (s) sets the gather; default 45 % of the beat. */
  function brandSnap(g, s, b, ctx) {
    const word = String(b.text).replace(/\s/g, '').toLowerCase(), r = PPM.rng(44 + b.i), Lo = LY(g), U = g.U, BS = b.size || 300, Z = 1.8, GA = .25, PB = .3; // gather + pull-back: still cut-speed, but no stutter under motion blur
    const BY = Lo.cy + (Lo.portrait ? 200 : 110), widths = [...word].map(ch => g.measure(ch, BS, 700, -.04)), totalW = widths.reduce((a, w) => a + w, 0);
    const bx = (i) => Lo.cx - totalW / 2 + widths.slice(0, i).reduce((a, w) => a + w, 0) + widths[i] / 2;
    const gs = b.gatherAt ?? s.d * .45, gk = E.in((s.t - gs) / GA), pk = E.snap((s.t - gs - GA) / PB), landed = s.t >= gs + GA;
    if (s.t < .4) [[[60, 200], [250, 120], [200, 380], [420, 440]], [[700, 200], [950, 250], [1100, 420], [980, 520]], [[600, 900], [800, 720], [1100, 820], [1300, 700]]].forEach(pts => g.brushSmear(scalePts(pts, Lo).map(([x, y]) => [x * U, y * U]), s.t / .25 * 1.3, { p0: Math.max(0, s.t / .25 - .4), width: 14, core: 2.5 }));
    if (!landed) [...word].forEach((ch, i) => {
      const lx = r.range(250, Lo.W - 240), ly = r.range(200, Lo.H - 180), la = r.range(-2.4, 2.4), sp = s.t * (.8 + i * .03);
      const fx = lx + Math.sin(sp * 1.7 + i * 2) * 90, fy = ly + Math.cos(sp * 1.3 + i) * 60, tx = Lo.cx + (bx(i) - Lo.cx) * Z, ty = Lo.cy + (BY - Lo.cy) * Z;
      const x = g.lerp(fx, tx, gk) * U, y = g.lerp(fy, ty, gk) * U, sz = g.lerp(56 + Math.abs(Math.sin(sp * 2 + i)) * 24, BS * Z, gk);
      g.layer({ x, y, rot: (la + s.t * (i % 2 ? -2.2 : 2.2)) * (1 - gk) }, () => g.text(ch, 0, 0, { size: sz, weight: gk > .5 ? 700 : 600, align: 'center' }));
      if (s.t > .5 && gk < .3) g.redLoops(x, y, 50, s.f, i + 1, { loops: s.t > 1.2 ? 2 : 1 });
    });
    else {
      const z = g.lerp(Z, 1, pk);
      g.layer({}, () => { g.ctx.translate(Lo.cx * U, Lo.cy * U); g.ctx.scale(z, z); g.ctx.translate(-Lo.cx * U, -Lo.cy * U);
        g.text(word, Lo.cx * U, BY * U, { size: BS, weight: 700, align: 'center', track: -.04, color: C.ink });
        if (b.object) obj(g, ctx, b.object, Lo.cx * U, (BY - (b.objectLift ?? 380)) * U, b.objectSize ?? 200, {}); });
      const gl = g.clamp((s.t - gs - GA - .1) / .35); if (gl > 0) g.guides([(BY + BS * .285) * U], { alpha: .8 * gl, x1: g.W * E.inOut(gl) });
      const tk = E.out((s.t - gs - GA - .15) / .25);
      if (b.tagline && tk > 0) { const ty = BY + BS * .285 + 78 + (1 - tk) * 12; g.text(b.tagline, Lo.cx * U, ty * U, { size: 34, weight: 500, align: 'center', color: '#4B4136', alpha: tk, track: .06 });
        g.ctx.save(); g.ctx.globalAlpha *= tk; g.ctx.fillStyle = '#D9201A'; g.ctx.beginPath(); g.ctx.arc(Lo.cx * U, (ty + 54) * U, 6.5 * U, 0, 7); g.ctx.fill(); g.ctx.restore(); }
    }
  }
  /** Card title, fframes-style: the whole word snaps in from (+48, +18) in 4 frames, a red block cursor collapses
   *  to a bar in 3, and an optional mono subtitle (b.sub) rises 24 px a frame later. */
  function titleSnap(g, s, b, x, y, size) {
    if (s.t < 0) return; const U = g.U, k = E.snap(s.t / .167), dx = (1 - k) * 48, dy = (1 - k) * 18;
    g.layer({ x: dx * U, y: dy * U }, () => g.caption(b.text, x, y, { size, weight: 600, color: C.white, cursorColor: '#ED3D27', cursorW: g.lerp(size * .68, size * .07, E.out(s.t / .125)), t: s.t, blink: s.t > .6, soft: false }));
    if (b.sub) { const k2 = E.expo((s.t - .042) / .21), a = E.out((s.t - .042) / .125); if (a > 0) g.text(b.sub, x + 4 * U, y + (70 + (1 - k2) * 24) * U, { size: 31, weight: 500, color: b.subColor || '#D4CABB', alpha: a, track: .04 }); }
  }
  /** A flow card whose flood-out would be under .25s: it stays flooded and the next shot drains it back into the object. */
  function shortFlood(b) { const full = (b.reveal?.at(-1)?.t ?? 0) + .22; return b.dur - Math.max(b.dur * .72, full + .35) < .25; }
  function accentFx(g, s, accent, x, y, size, flowCtx) {
    if (accent === 'beam') { g.beam(x - 100, y + 80, -0.62, 1400, 160, 300, (s.t - .1) / .15, '#E2261A'); g.beam(x - 80, y + 120, 2.45, 900, 50, 160, (s.t - .1) / .15, '#E2261A'); }
    if (accent === 'notes') [['notes2', x + 230, y - 230, .2], ['note', x + 400, y + 260, .35], ['note', x + 120, y + 330, .5]].forEach(([n, nx, ny, t0], i) => { if (s.t > t0) g.sprite(n, nx, ny + Math.sin(s.t * 3 + i) * 8, i ? 120 : 150, { rot: Math.sin(s.t * 2 + i) * .15 }); });
    if (accent === 'scribble' && s.t < .25) g.stroke(g.scribblePath('zigzag', x + 130, y - 140, 260, 380, 3), s.t / .12, { color: C.white, width: 3 });
    if (accent === 'orbits') { g.layer({ alpha: .9 }, () => { g.orbit(x, y, 230, 80, -.3, g.clamp((s.t - .2) / .8), 'front', { len: 2.4, width: 3.2 }); g.orbit(x, y, 260, 90, .5, g.clamp((s.t - .35) / .8), 'front', { len: 2.4, width: 3.2 }); }); }
    if (accent === 'sparkle' && flowCtx) g.sparkle(x + size * .42, y - size * .42, 110 * E.back(g.clamp((s.t - .15) / .2)), { rot: .3 + s.t * .3, ax: 1.2, ay: .8, k: 1.9, glow: 22 });
  }

  /** Resolve spec.silhouettes → { key: { src: shapeFn|maskCanvas, kind } }. "shape:profile", "shape:hand", "mask:<url>". */
  async function loadShapes(spec) {
    const out = {};
    for (const [k, v] of Object.entries(spec.silhouettes || {})) {
      const [kind, arg] = String(v).split(':');
      if (kind === 'shape') out[k] = { src: arg === 'hand' ? PPM.SHAPES.hand(760, 1130, 1.05, .95) : PPM.SHAPES.profile(980, 190, 1.05), kind: arg };
      else if (kind === 'thermal') { // a heat render or any light-on-black image, re-lit through the engine's thermal ramp (luminance → body mask)
        const m = await PPM.loadMask(v.slice(8), { luma: true, invert: true, threshold: 40 });
        out[k] = { src: PPM.placeMask(m, { x: 720, y: 540, h: 1080 }), kind: /hand/i.test(k) ? 'hand' : 'head' };
      }
      else if (kind === 'heat') { // a ready-made heat render on black: draw it as-is, derive the mask from its luminance
        const url = v.slice(5), img = await new Promise((ok, err) => { const im = new Image(); im.onload = () => ok(im); im.onerror = err; im.src = url; });
        const m = await PPM.loadMask(url, { luma: true, invert: true, threshold: 40 });
        out[k] = { img, src: PPM.placeMask(m, { x: 720, y: 540, h: 1080 }), kind: /hand/i.test(k) ? 'hand' : 'head' };
      }
      else if (kind === 'mask') { const m = await PPM.loadMask(v.slice(5)); const isHand = /hand/i.test(k); out[k] = { src: PPM.placeMask(m, isHand ? { x: 760, y: 760, h: 900 } : { x: 1000, y: 640, h: 980 }), kind: isHand ? 'hand' : 'head' }; }
    }
    return out;
  }

  async function build(canvas, spec, words) {
    const plan = PPMPlan.plan(spec, words);
    if (plan.errors.length) throw new Error('spec errors:\n' + plan.errors.join('\n'));
    const flow = plan.mode === 'flow';
    const film = PPM.film(canvas, { w: spec.size?.[0] || 1440, h: spec.size?.[1] || 1080, fps: +(new URLSearchParams(location.search).get('fps') || plan.fps), font: spec.font || (flow ? 'Geist' : 'Outfit'),
      camera: flow ? { float: 7, rot: .35, push: .04 } : { float: 0, push: 0 }, treatment: spec.treatment });
    const ctx = { spec, plan, flow, objects: spec.objects?.length ? spec.objects : PPM.KITCHEN_SET, shapes: await loadShapes(spec) };
    plan.beats.forEach((b, k) => {
      const fn = B[b.type], orig = spec.beats[b.i] || {};
      if (flow && b.type === 'card' && !orig.world) b.world = 'paper'; // flow cards flood void out of the object over the page
      if (flow && b.type === 'hero' && !orig.world) b.world = 'paper'; // the yellow card is drawn in-shot and wipes off to reveal paper
      film.shot(b.dur, b.world, (g, s) => {
        const HO = Math.min(.1, b.dur * .25); // a short blend, not a dissolve (≈6 frames @60)
        if (flow && k > 0 && plan.beats[k - 1].transition === 'handoff' && s.t < HO) { // continuous handoff: start on the outgoing shot's last frame, then cross to this one
          g.under(k - 1, plan.beats[k - 1].dur - 1e-3); g.ctx.save(); g.ctx.globalAlpha = E.inOut(s.t / HO); g.bg(b.world); g.ctx.restore();
          g.ctx.globalAlpha = E.inOut(s.t / HO);
        }
        fn(g, s, b, ctx);
        const pv = plan.beats[k - 1], DR = .28;
        if (flow && pv && pv.type === 'card' && pv.transition === 'handoff' && shortFlood(pv) && plan.beats[k].world !== 'void' && s.t < DR) { // drain the card's flood back into its object over this shot's opening
          const Lo = LY(g), [ox, oy] = Lo.card, R = Math.hypot(Math.max(ox, Lo.W - ox), Math.max(oy, Lo.H - oy)) * 1.05 * (1 - E.inOut(s.t / DR));
          g.ctx.save(); g.ctx.globalAlpha = 1; g.ctx.beginPath(); g.ctx.arc(ox * g.U, oy * g.U, R * g.U, 0, 7); g.ctx.clip(); g.under(k - 1, pv.dur - 1e-3); g.ctx.restore();
        }
      }, { push: b.push, vignette: b.type === 'hero' || b.type === 'flash' ? .25 : undefined });
    });
    film.plan = plan;
    return film;
  }

  window.PPMCompose = { build, builders: B, typedAt };
})();
