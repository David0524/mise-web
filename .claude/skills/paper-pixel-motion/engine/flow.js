/* paper-pixel-motion · flow extensions
 * Load after ppm.js (and sprites.js). Adds:
 *   - hand-placed grid sprites (PPM.defGrid) and 3D "block" rendering (extrusion + per-cell bevel + contact shadow)
 *   - heat silhouettes v2: distance-transform heat + hotspot + moving noise, razor-sharp mask edge, outer glow
 *   - typed captions behind a block cursor, centred lines that glide as they grow, spoken-word underline
 *   - continuous transitions: flood (from a point), burn (edges close in behind a hot edge),
 *     fallThrough (scene revealed inside a mask that scales past the lens), pixel morph between sprites
 *   - image masks (CC0 silhouettes, ChatGPT outputs) with alpha or luminance keying
 */
(function () {
  'use strict';
  const { mk, clamp, lerp, ease, rng, noise1, SPRITES, SPRITE_DEFS } = PPM;

  // ───────────── grid sprites (hand-placed cells) ─────────────
  /**
   * PPM.defGrid('heart', [
   *   '..rr..rr..',
   *   '.rRRrrRRr.', ...], { r: '#d61f1f', R: '#ff6a5a' })
   * '.' or ' ' = empty. Each char = one cell, coloured from the palette. 16×16 is the house size.
   */
  PPM.defGrid = function (name, rows, pal) {
    const gh = rows.length, gw = Math.max(...rows.map(r => r.length));
    SPRITE_DEFS[name] = {
      gw, gh, opts: { outline: false, grid: true },
      draw: ({ px }) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) px(x, y, 1, 1, pal[ch]); })),
    };
    delete SPRITES[name];
  };

  /** Bake the 3D block version once: extrusion layers down-right, then the face, then a thin bevel on every cell. */
  function blockOf(name, cell = 10) {
    const sp = PPM.sprite(name); if (sp.block) return sp.block;
    const src = sp.img, gw = src.width, gh = src.height, d = src.getContext('2d').getImageData(0, 0, gw, gh).data;
    const depth = Math.round(cell * .55), W = gw * cell + depth + 2, H = gh * cell + depth + 2, c = mk(W, H), x = c.getContext('2d');
    const cells = [];
    for (let y = 0; y < gh; y++) for (let X = 0; X < gw; X++) { const i = (y * gw + X) * 4; if (d[i + 3] > 127) cells.push([X, y, d[i], d[i + 1], d[i + 2]]); }
    // extrusion: darkened copies stepping down-right (back to front)
    for (let k = depth; k >= 1; k--) {
      const dk = .42 + .18 * (1 - k / depth);
      cells.forEach(([X, y, r, g, b]) => { x.fillStyle = `rgb(${r * dk | 0},${g * dk | 0},${b * dk | 0})`; x.fillRect(X * cell + k, y * cell + k, cell, cell); });
    }
    // face + bevel
    const bv = Math.max(1, Math.round(cell * .12));
    cells.forEach(([X, y, r, g, b]) => {
      const px = X * cell, py = y * cell;
      x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(px, py, cell, cell);
      x.fillStyle = `rgba(255,255,255,.22)`; x.fillRect(px, py, cell, bv); x.fillRect(px, py, bv, cell);
      x.fillStyle = `rgba(0,0,0,.22)`; x.fillRect(px, py + cell - bv, cell, bv); x.fillRect(px + cell - bv, py, bv, cell);
    });
    sp.block = { img: c, w: W, h: H, faceH: gh * cell, cell };
    return sp.block;
  }

  // ───────────── heat silhouettes ─────────────
  /** Chamfer (3-4) distance transform on an alpha mask. Out-of-frame neighbours are skipped, so a limb cut by
   *  the frame border is NOT treated as an edge (the body continues past the frame). */
  function distance(alpha, w, h) {
    const INF = 1e9, D = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) D[i] = alpha[i] > 127 ? INF : 0;
    const f = (x, y, dx, dy, c) => { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) return INF; return D[Y * w + X] + c; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!D[i]) continue; D[i] = Math.min(D[i], f(x, y, -1, 0, 3), f(x, y, 0, -1, 3), f(x, y, -1, -1, 4), f(x, y, 1, -1, 4)); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!D[i]) continue; D[i] = Math.min(D[i], f(x, y, 1, 0, 3), f(x, y, 0, 1, 3), f(x, y, 1, 1, 4), f(x, y, -1, 1, 4)); }
    for (let i = 0; i < w * h; i++) D[i] = D[i] >= INF ? 0 : D[i] / 3;
    return D;
  }
  const HEAT_RAMP = [[0, '#050202'], [.12, '#3d0704'], [.3, '#B3170F'], [.5, '#E8420F'], [.68, '#FF8A1E'], [.84, '#FFBE50'], [.94, '#FFDDA0'], [1, '#FFEDC8']]; // warm to the very top: never neutral white

  /** Build (once) a heat source from a shape fn ((ctx)=>fill in 1440×1080 space) or an image/canvas with alpha. */
  function heatSource(film, key, src, o) {
    const cache = film._cache, k = 'heat_' + key; if (cache[k]) return cache[k];
    const W = film.w, H = film.h, q = 4, w = Math.ceil(W / q), h = Math.ceil(H / q);
    const full = mk(W, H), fx = full.getContext('2d');
    if (typeof src === 'function') { fx.scale(W / 1440, H / 1080); fx.fillStyle = '#fff'; src(fx); }
    else fx.drawImage(src, 0, 0, W, H);
    const small = mk(w, h), sx = small.getContext('2d'); sx.drawImage(full, 0, 0, w, h);
    const a = sx.getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = a[i * 4 + 3];
    const D = distance(alpha, w, h);
    let max = 0; for (const v of D) max = Math.max(max, v);
    const thick = (o.thick ? o.thick / q : max) || 1, base = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) base[i] = .28 + .6 * Math.pow(clamp(D[i] / thick), .5);
    // hold the edge value outside so nothing dark bleeds in on upscale
    const edgeV = .3;
    for (let i = 0; i < w * h; i++) if (!alpha[i]) base[i] = edgeV; else base[i] = Math.max(base[i], edgeV);
    return (cache[k] = { full, w, h, q, base, alpha, img: mk(w, h) });
  }

  PPM.extendKit((g, film) => {
    const { C } = PPM;
    const U = () => g.U;

    /** Sprite as a 3D pixel block: extrusion, bevel, soft contact shadow. o: rot, flip (coin flip: -1..1 x-scale), shadow, alpha, blur. */
    g.block = function (name, x, y, size, o = {}) {
      const b = blockOf(name, o.cell || 10), ctx = g.ctx, s = (size * g.U) / b.faceH;
      if (o.shadow !== false) {
        ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1) * (o.shadowAlpha ?? .28); ctx.filter = `blur(${10 * g.U}px)`; ctx.fillStyle = '#1a1414';
        ctx.beginPath(); ctx.ellipse(x + 6 * g.U, y + size * g.U * .55 + (o.lift || 0) * g.U, size * g.U * .42 * Math.abs(o.flipX ?? 1), size * g.U * .07, 0, 0, 7); ctx.fill(); ctx.restore();
      }
      ctx.save(); ctx.translate(x, y - (o.lift || 0) * g.U); if (o.rot) ctx.rotate(o.rot);
      ctx.scale(s * (o.flipX ?? 1) * (o.flip ? -1 : 1), s); ctx.imageSmoothingEnabled = false; ctx.globalAlpha *= o.alpha ?? 1;
      if (o.blur) ctx.filter = `blur(${o.blur * g.U / s}px)`;
      ctx.drawImage(b.img, -b.faceH * (b.w / b.h) / 2, -b.faceH / 2);
      if (o.ink) { ctx.globalAlpha *= clamp(o.ink); const sil = film._cache['inkblk_' + name] || (film._cache['inkblk_' + name] = (() => { const c = mk(b.w, b.h), x = c.getContext('2d'); x.drawImage(b.img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#0d0c0c'; x.fillRect(0, 0, b.w, b.h); return c; })()); ctx.drawImage(sil, -b.faceH * (b.w / b.h) / 2, -b.faceH / 2); }
      ctx.restore();
    };

    /**
     * Tilted ring in perspective: front items bigger, lower and drawn last; each one bobs.
     * o: size, tilt (0..1 vertical squash), spin (radians), bob (px), per(i,{x,y,z,a}) → overrides {skip, x, y, size, opts}
     */
    g.ring = function (names, cx, cy, R, o = {}) {
      const tilt = o.tilt ?? .38, t = o.t || 0;
      const items = names.map((n, i) => { const a = (o.spin || 0) + (i / names.length) * Math.PI * 2; return { n, i, a, z: Math.sin(a) }; }).sort((a, b) => a.z - b.z);
      items.forEach(it => {
        const persp = lerp(o.back ?? .7, o.front ?? 1.25, (it.z + 1) / 2);
        let x = cx + Math.cos(it.a) * R * g.U, y = cy + Math.sin(it.a) * R * tilt * g.U + it.z * 18 * g.U;
        y += Math.sin(t * 2.2 + it.i * 1.7) * (o.bob ?? 6) * g.U;
        const per = o.per ? o.per(it.i, { x, y, z: it.z, a: it.a }) || {} : {};
        if (per.skip) return;
        g.block(it.n, per.x ?? x, per.y ?? y, (per.size ?? (o.size || 120)) * persp, { rot: Math.cos(it.a) * .1, ...(per.opts || {}) });
      });
    };
    /** Front-left slot index for a ring at a given spin (where a hero object should sit when its word lands). */
    g.ringFrontLeft = (n, spin) => { let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const a = spin + i / n * Math.PI * 2, d = Math.hypot(Math.cos(a) + .55, Math.sin(a) - .83); if (d < bd) { bd = d; best = i; } } return best; };

    /**
     * Heat silhouette. src: shape fn or image with the silhouette in ALPHA. o:
     *   key (cache), t (seconds, drives noise), hotspot [x,y,r] in 1440×1080 space, noise (0..1), heat (0..1 fade-in),
     *   glow (px), offset {x,y}, scale (about the frame centre), thick (px for full heat; default = thickest point)
     */
    g.heat = function (src, o = {}) {
      const hs = heatSource(film, o.key || 'h', src, o), { w, h, q, base, alpha } = hs, ctx = g.ctx, W = film.w, H = film.h;
      const ic = hs.img.getContext('2d'), id = ic.createImageData(w, h), d = id.data, lut = PPM.thermalLUT(o.ramp || HEAT_RAMP);
      const t = o.t || 0, heat = o.heat ?? 1, nz = o.noise ?? .08;
      const [hx, hy, hr, hry] = o.hotspot || [0, 0, 0], hr2 = hry || hr, sxs = 1440 / W * q, sys = 1080 / H * q;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; let v = base[i];
        if (hr) { const dx = x * sxs - hx, dy = y * sys - hy; v += (o.hotspotStrength ?? .2) * Math.exp(-(dx * dx) / (hr * hr) - (dy * dy) / (hr2 * hr2)); }
        if (nz) v += nz * (noise2(x * .045, y * .045 + t * .35, 1) * .65 + noise2(x * .11 + t * .2, y * .11, 2) * .35);
        v = clamp(v * (.25 + .75 * heat)); const j = (v * 255 | 0) * 3;
        d[i * 4] = lut[j]; d[i * 4 + 1] = lut[j + 1]; d[i * 4 + 2] = lut[j + 2]; d[i * 4 + 3] = 255;
      }
      ic.putImageData(id, 0, 0);
      // upscale → cut with the full-res mask (razor edge) → glow outside
      const L = film.layer(7), lx = L.getContext('2d');
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, W, H);
      lx.imageSmoothingEnabled = true; lx.drawImage(hs.img, 0, 0, W, H);
      lx.globalCompositeOperation = 'destination-in'; lx.drawImage(hs.full, 0, 0); lx.globalCompositeOperation = 'source-over';
      ctx.save();
      const ox = (o.offset?.x || 0) * g.U, oy = (o.offset?.y || 0) * g.U, sc = o.scale || 1, ax = (o.anchor?.[0] ?? 720) * g.U, ay = (o.anchor?.[1] ?? 540) * g.U;
      ctx.translate(ax + ox, ay + oy); ctx.scale(sc, sc); ctx.translate(-ax, -ay);
      ctx.globalAlpha *= o.alpha ?? 1;
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${(o.glow ?? 26) * g.U}px)`; ctx.globalAlpha *= (o.glowAlpha ?? .35) * heat; ctx.drawImage(L, 0, 0); ctx.restore();
      ctx.drawImage(L, 0, 0);
      ctx.restore();
      return hs;
    };
    /** Block that dissolves by dropping whole cells (dither dropout, colours unchanged). p 0..1 = fraction gone. */
    g.blockDissolve = function (name, x, y, size, p, o = {}) {
      if (p >= 1) return; if (p <= 0) return g.block(name, x, y, size, o);
      if (o.shadow !== false) { const c = g.ctx; c.save(); c.globalAlpha *= (o.shadowAlpha ?? .28) * Math.pow(1 - p, 1.5); c.filter = `blur(${10 * g.U}px)`; c.fillStyle = '#1a1414'; c.beginPath(); c.ellipse(x + 6 * g.U, y + size * g.U * .55, size * g.U * .42, size * g.U * .07, 0, 0, 7); c.fill(); c.restore(); } // shadow fades with the dropout
      const L = film.layer(8), lx = L.getContext('2d'), old = g.__swap(lx);
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, film.w, film.h);
      g.block(name, x, y, size, { ...o, shadow: false }); g.__swap(old);
      const cell = size * g.U / PPM.sprite(name).h, x0 = x - size * g.U, y0 = y - size * g.U;
      lx.globalCompositeOperation = 'destination-out';
      for (let cy = 0; cy < size * 2 * g.U / cell; cy++) for (let cx = 0; cx < size * 2 * g.U / cell; cx++) if (PPM.hash(cx * 7919 + cy * 104729 + (o.seed || 1)) < p) lx.fillRect(x0 + cx * cell - .5, y0 + cy * cell - .5, cell + 1, cell + 1);
      lx.globalCompositeOperation = 'source-over';
      g.ctx.save(); g.ctx.setTransform(1, 0, 0, 1, 0, 0); g.ctx.drawImage(L, 0, 0); g.ctx.restore();
    };
    /** Full-frame alpha mask of a block sprite at (x,y,size) — a window for fallThrough. Cached. */
    g.blockMask = function (name, x, y, size) {
      const k = 'bmask_' + [name, x, y, size].join('_'); if (film._cache[k]) return film._cache[k];
      const c = mk(film.w, film.h), cx = c.getContext('2d'), old = g.__swap(cx); g.block(name, x, y, size, { shadow: false }); g.__swap(old);
      return (film._cache[k] = c);
    };
    /** Draw fn into a layer clipped to a heat source's full-res mask transformed like g.heat(o). */
    g.maskOf = (key) => film._cache['heat_' + key]?.full;

    // ───────────── typing ─────────────
    /** Characters visible at time t, typing from t0 at cps (or from per-word timings via g.typedFromWords). */
    g.typed = (str, t0, cps, t) => str.slice(0, clamp(Math.floor((t - t0) * cps), 0, str.length));
    /** From whisper word timings [{word,start,end}] → string visible at t (each word types across its spoken span). */
    g.typedFromWords = (words, t) => {
      let s = '';
      for (const w of words) {
        if (t < w.start) break;
        const k = clamp((t - w.start) / Math.max(.06, (w.end - w.start) * .8));
        s += (s ? ' ' : '') + w.word.slice(0, Math.ceil(w.word.length * k));
        if (k < 1) break;
      }
      return s;
    };
    /** Caption behind a block cursor. align 'left' | 'center' (centre glides as the line grows). */
    g.caption = function (shown, x, y, o = {}) {
      const size = o.size || 26, weight = o.weight || 500, color = o.color || C.ink;
      const wNow = g.measure(shown, size, weight), cw = size * .55 * g.U;
      const wLay = o.full != null ? g.measure(o.full, size, weight) : wNow; // lay out on the FINAL width so the line never re-centres while typing
      const x0 = o.align === 'center' ? x - (wLay + cw * 1.4) / 2 : x;
      if (shown) g.text(shown, x0, y, { size, weight, color, soft: o.soft });
      if (o.cursor !== false && (!o.blink || Math.floor((o.t || 0) * 3.5) % 2 === 0)) { g.ctx.save(); g.ctx.fillStyle = o.cursorColor || color; g.ctx.fillRect(x0 + wNow + cw * .25, y - size * .6 * g.U, cw, size * 1.2 * g.U); g.ctx.restore(); }
      return { x0, w: wNow };
    };
    /** Red underline drawing itself under [x, x+w]. */
    g.underline = (x, y, w, p, o = {}) => { if (p <= 0) return; g.ctx.save(); g.ctx.fillStyle = o.color || C.red; g.ctx.fillRect(x, y, w * ease.inOut(p), (o.h || 3.5) * g.U); g.ctx.restore(); };

    // ───────────── transitions ─────────────
    /** Flood a colour out from (x,y) to cover the frame. p 0..1, soft start (inOut). Returns current radius. */
    g.flood = function (x, y, p, color = C.void) {
      const R = Math.hypot(Math.max(x, film.w - x), Math.max(y, film.h - y)) * 1.05 * ease.inOut(clamp(p));
      if (R <= 0) return 0; const ctx = g.ctx; ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); ctx.restore(); return R;
    };
    /** Clip subsequent drawing (fn) to the flood circle. */
    g.inFlood = function (x, y, p, fn) {
      const R = Math.hypot(Math.max(x, film.w - x), Math.max(y, film.h - y)) * 1.05 * ease.inOut(clamp(p));
      if (R <= 0) return; const ctx = g.ctx; ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.clip(); fn(); ctx.restore();
    };
    /** Paper burns away: black closes in from the edges onto (x,y). Ragged noisy edge (boils on twos), a dark char
     *  band and a narrow hot glow just outside the unburnt area. p 0..1; o: toR, edge (glow px), char (px), t (s). */
    g.burn = function (x, y, p, o = {}) {
      const ctx = g.ctx, U = g.U, Rmax = Math.hypot(film.w, film.h) * .75, R = lerp(Rmax, o.toR ?? 0, ease.inOut(clamp(p)));
      if (p <= 0) return;
      const tq = Math.floor((o.t ?? p * 10) * 12) / 12, amp = (o.amp ?? 30) * U, lobes = o.lobes ?? 8;
      const ring = (dr) => { const pts = []; for (let i = 0; i < 240; i++) { const a = i / 240 * Math.PI * 2, n = noise1(a / (Math.PI * 2) * lobes + tq * 1.7, 21) * .75 + noise1(a / (Math.PI * 2) * lobes * 3 - tq * 2.3, 22) * .27 + noise1(a / (Math.PI * 2) * lobes * 7 + tq * 3, 23) * .12; pts.push([x + Math.cos(a) * Math.max(0, R + n * amp + dr), y + Math.sin(a) * Math.max(0, R + n * amp + dr)]); } return pts; };
      const path = (c, pts) => { c.beginPath(); pts.forEach(([X, Y], i) => (i ? c.lineTo(X, Y) : c.moveTo(X, Y))); c.closePath(); };
      const L = film.layer(6), lx = L.getContext('2d'); lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, film.w, film.h);
      const edge = ring(0);
      // hot glow hugging the inside of the edge
      lx.save(); path(lx, edge); lx.clip(); lx.filter = `blur(${(o.edge || 40) * U * .5}px)`; lx.strokeStyle = '#FF6A1E'; lx.lineWidth = (o.edge || 40) * U; path(lx, ring(-4 * U)); lx.stroke(); lx.restore();
      // char band + black outside
      lx.save(); lx.fillStyle = o.color || C.void; lx.beginPath(); lx.rect(0, 0, film.w, film.h); edge.slice().reverse().forEach(([X, Y], i) => (i ? lx.lineTo(X, Y) : lx.moveTo(X, Y))); lx.closePath(); lx.fill('evenodd'); lx.restore();
      lx.save(); lx.strokeStyle = '#2A1810'; lx.lineWidth = (o.char ?? 16) * U; lx.lineJoin = 'round'; path(lx, edge); lx.stroke(); lx.restore();
      lx.save(); lx.strokeStyle = 'rgba(255,170,60,.9)'; lx.lineWidth = 2 * U; path(lx, ring(-(o.char ?? 16) * U * .5 - 2 * U)); lx.stroke(); lx.restore();
      ctx.drawImage(L, 0, 0);
    };
    /**
     * Fall through a mask: draw `inner` (fn) clipped to the mask (canvas, full-res) scaled about (px,py) by
     * 1 + k·p³ until it covers the frame. `inner` zooms less (depth). Draw the outer scene before calling.
     */
    g.fallThrough = function (mask, px, py, p, inner, o = {}) {
      const W = film.w, H = film.h, k = o.k ?? 60, s = 1 + k * Math.pow(clamp(p), 3), si = 1 + (o.innerK ?? 1.2) * Math.pow(clamp(p), 3) * (1 - clamp(p) * .3);
      const L = film.layer(5), lx = L.getContext('2d');
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, W, H);
      lx.save(); lx.translate(W / 2, H / 2); lx.scale(si, si); lx.translate(-W / 2, -H / 2);
      const old = g.__swap(lx); inner(g); g.__swap(old); lx.restore();
      lx.globalCompositeOperation = 'destination-in'; lx.save(); lx.translate(px, py); lx.scale(s, s); lx.translate(-px, -py); lx.drawImage(mask, 0, 0, W, H); lx.restore();
      lx.globalCompositeOperation = 'source-over';
      g.ctx.drawImage(L, 0, 0);
      return s;
    };
    /** Render another shot (index, local time) as a layer under the current one — continuous handoffs. */
    g.under = function (i, t) { const L = film.layer(4 + 10 * (i % 3)), lx = L.getContext('2d'); film.drawShot(i, t, lx); g.ctx.save(); g.ctx.setTransform(1, 0, 0, 1, 0, 0); g.ctx.drawImage(L, 0, 0); g.ctx.restore(); };

    /**
     * Pixel morph from sprite a to sprite b at (x,y), height size. Each cell of A is paired with a cell of B and
     * glides position + colour, with a small random delay per cell.
     */
    g.morph = function (a, b, p, x, y, size, o = {}) {
      const key = 'morph_' + a + '_' + b, ctx = g.ctx;
      let M = film._cache[key];
      if (!M) {
        const cellsOf = (n) => { const sp = PPM.sprite(n), d = sp.img.getContext('2d').getImageData(0, 0, sp.w, sp.h).data, out = []; for (let yy = 0; yy < sp.h; yy++) for (let xx = 0; xx < sp.w; xx++) { const i = (yy * sp.w + xx) * 4; if (d[i + 3] > 127) out.push({ x: xx - sp.w / 2, y: yy - sp.h / 2, c: [d[i], d[i + 1], d[i + 2]], h: sp.h }); } return out; };
        const A = cellsOf(a), B = cellsOf(b), key2 = (c) => Math.atan2(c.y, c.x) * 3 + Math.hypot(c.x, c.y) * .15;
        A.sort((m, n) => key2(m) - key2(n)); B.sort((m, n) => key2(m) - key2(n));
        const N = Math.max(A.length, B.length), r = rng(7), pairs = [];
        for (let i = 0; i < N; i++) pairs.push({ a: A[Math.floor(i * A.length / N)], b: B[Math.floor(i * B.length / N)], d: r() * .35 });
        M = film._cache[key] = { pairs, ha: A[0]?.h || 16, hb: B[0]?.h || 16 };
      }
      const cell = size * g.U / lerp(M.ha, M.hb, ease.inOut(p));
      if (o.shadow !== false) { ctx.save(); ctx.globalAlpha *= .25; ctx.filter = `blur(${10 * g.U}px)`; ctx.fillStyle = '#1a1414'; ctx.beginPath(); ctx.ellipse(x + 6 * g.U, y + size * g.U * .55 + 40 * g.U * 0, size * g.U * .42, size * g.U * .07, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.save();
      for (const pass of o.flat ? [1] : [0, 1]) for (const pr of M.pairs) {
        const k = ease.inOut(clamp((p - pr.d) / .65)), sa = size * g.U / M.ha, sb = size * g.U / M.hb;
        const X = x + lerp(pr.a.x * sa, pr.b.x * sb, k), Y = y + lerp(pr.a.y * sa, pr.b.y * sb, k);
        const c = pr.a.c.map((v, j) => (lerp(v, pr.b.c[j], k) * (pass ? 1 : .5)) | 0), d = pass ? 0 : cell * .55;
        ctx.fillStyle = `rgb(${c})`; ctx.fillRect(X + d, Y + d, cell + .6, cell + .6);
        if (pass) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(X, Y, cell, cell * .12); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X, Y + cell * .88, cell, cell * .12); }
      }
      ctx.restore();
    };

    /** Sparks: short bright strokes bursting from (x,y). p 0..1. */
    g.sparks = function (x, y, p, o = {}) {
      if (p <= 0 || p >= 1) return; const r = rng(o.seed || 9), n = o.n || 9, ctx = g.ctx;
      ctx.save(); ctx.strokeStyle = o.color || '#FFD24A'; ctx.lineCap = 'round'; ctx.shadowColor = o.color || '#FFB21E'; ctx.shadowBlur = 8 * g.U;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + r.range(-1.3, 1.3), sp = r.range(90, 180) * g.U, d0 = sp * (.25 + .75 * ease.out(p)) * .55, d1 = sp * (.25 + .75 * ease.out(p)); // visible from frame 1
        ctx.globalAlpha = 1 - p * p; ctx.lineWidth = r.range(3, 4.5) * g.U * (1 - p * .5);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0 + p * p * 60 * g.U); ctx.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1 + p * p * 60 * g.U); ctx.stroke();
      }
      ctx.restore();
    };
  });

  /** Load an image as a mask canvas (silhouette in alpha). opts.luma: derive alpha from darkness (dark = body) or
   *  {invert:true} for light bodies; opts.extend: pixels to extend the mask past a border it touches. */
  PPM.loadMask = function (url, opts = {}) {
    return new Promise((ok, err) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => {
        const c = mk(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height); let hasAlpha = false;
        for (let i = 3; i < d.data.length; i += 4) if (d.data[i] < 250) { hasAlpha = true; break; }
        if (!hasAlpha || opts.luma) {
          for (let i = 0; i < d.data.length; i += 4) { const l = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3; const a = opts.invert ? l : 255 - l; d.data[i + 3] = a > (opts.threshold ?? 128) ? 255 : 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; }
          x.putImageData(d, 0, 0);
        }
        ok(c);
      };
      im.onerror = err; im.src = url;
    });
  };
  /** Place a mask image into a 1440×1080 frame: returns a shape-like canvas. fit: {x,y,h} centre + height. */
  PPM.placeMask = function (mask, { x = 1000, y = 600, h = 900, flip = false } = {}) {
    const c = mk(1440, 1080), cx = c.getContext('2d'), s = h / mask.height;
    cx.translate(x, y); if (flip) cx.scale(-1, 1); cx.drawImage(mask, -mask.width * s / 2, -mask.height * s / 2, mask.width * s, mask.height * s);
    return c;
  };

  function noise2(x, y, seed) { // value noise
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const H = (a, b) => PPM.hash(a * 374761393 + b * 668265263 + seed * 1442695041);
    return lerp(lerp(H(xi, yi), H(xi + 1, yi), u), lerp(H(xi, yi + 1), H(xi + 1, yi + 1), u), v) * 2 - 1;
  }
})();
