/* paper-pixel-motion engine — deterministic canvas-2D film renderer.
 * Every frame is a pure function of its frame number, so a headless browser can
 * render frame N in any order (see tools/render.mjs).
 *
 *   const film = PPM.film(canvas, { w: 1440, h: 1080, fps: 24 });
 *   film.shot(1.2, 'paper', (g, s) => { ... });   // duration (s), world, draw fn
 *   film.play();                                  // live preview
 *
 * Inside a draw fn: `g` is the drawing kit (all helpers below, bound to the
 * shot's context), `s` = { t, f, d, p, F, rnd } — seconds into shot, frame into
 * shot, shot duration, progress 0..1, global frame, seeded random for this shot.
 */
(function (root) {
  'use strict';

  // ───────────────────────────── palette ─────────────────────────────
  const C = {
    paper: '#E1E3E2', paperShade: '#9A9899', ink: '#322823', void: '#141414',
    red: '#D9201A', redCore: '#BB2016', redDeep: '#35171B', cyan: '#32B9E1', blue: '#2E5BFF',
    white: '#F2F0EC', yellowFlash: '#E2B321', teal: '#37C3C3', olive: '#6B5A2E', splat: '#E8A21C',
  };
  const WORLD_BG = { paper: C.paper, void: C.void, red: '#D8231B', yellow: C.yellowFlash, wash: '#4A3E3E' };
  const FONT = '"Outfit", "Poppins", "Urbanist", system-ui, sans-serif';

  // ───────────────────────────── math / random ─────────────────────────────
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    lin: t => t,
    out: t => 1 - Math.pow(1 - clamp(t), 3),
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t))),
    in: t => Math.pow(clamp(t), 3),
    inOut: t => (t = clamp(t), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: t => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  function rng(seed) { // mulberry32
    let a = (seed >>> 0) || 1;
    const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1));
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.sign = () => (r() < .5 ? -1 : 1);
    return r;
  }
  const hash = (n) => { n = Math.imul(n ^ 61 ^ (n >>> 16), 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
  function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 1013), hash(i + 1 + seed * 1013), u) * 2 - 1; }
  /** Hold a value for `n` frames: animate-on-twos/threes. */
  const stepped = (f, n = 2) => Math.floor(f / n) * n;

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ───────────────────────────── film treatment ─────────────────────────────
  const GRAIN_TILES = [];
  function grainTile(i) {
    if (GRAIN_TILES[i]) return GRAIN_TILES[i];
    const s = 256, c = mk(s, s), x = c.getContext('2d'), d = x.createImageData(s, s), r = rng(9001 + i * 77);
    for (let p = 0; p < d.data.length; p += 4) {
      // sum of uniforms ≈ gaussian, centred on 128
      const v = 128 + ((r() + r() + r() - 1.5) * 150);
      d.data[p] = d.data[p + 1] = d.data[p + 2] = v; d.data[p + 3] = 255;
    }
    x.putImageData(d, 0, 0); GRAIN_TILES[i] = c; return c;
  }

  // ───────────────────────────── sprites ─────────────────────────────
  // Sprites are drawn with simple shapes on a tiny grid, alpha-thresholded, given a 1-px
  // dark outline, then scaled up with nearest-neighbour: original chunky pixel art.
  const SPRITES = {};
  const SPRITE_DEFS = {};
  function defSprite(name, gw, gh, draw, opts = {}) { SPRITE_DEFS[name] = { gw, gh, draw, opts }; }
  function shade(hex, k) { // k<0 darker, k>0 lighter
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
    const t = k < 0 ? 0 : 255, a = Math.abs(k);
    r = Math.round(lerp(r, t, a)); g = Math.round(lerp(g, t, a)); b = Math.round(lerp(b, t, a));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function buildSprite(name) {
    const def = SPRITE_DEFS[name]; if (!def) throw new Error('unknown sprite ' + name);
    const { gw, gh } = def, pad = 1, c = mk(gw + pad * 2, gh + pad * 2), x = c.getContext('2d');
    x.imageSmoothingEnabled = false; x.translate(pad, pad);
    const px = (X, Y, w = 1, h = 1, col) => { if (col) x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), Math.round(w), Math.round(h)); };
    const circ = (cx, cy, r, col) => { x.fillStyle = col; for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r + r * .8) x.fillRect(Math.floor(cx + xx), Math.floor(cy + yy), 1, 1); };
    const poly = (pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); };
    def.draw({ x, px, circ, poly, shade });
    x.setTransform(1, 0, 0, 1, 0, 0);
    // threshold alpha + outline
    const d = x.getImageData(0, 0, c.width, c.height), W = c.width, H = c.height, src = new Uint8ClampedArray(d.data);
    for (let i = 0; i < src.length; i += 4) { if (src[i + 3] < 128) { src[i + 3] = 0; } else src[i + 3] = 255; }
    const outline = def.opts.outline || '#1d1a1c';
    const on = parseInt(outline.slice(1), 16);
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
      const i = (y * W + X) * 4;
      if (src[i + 3]) { d.data.set(src.subarray(i, i + 4), i); continue; }
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = X + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && src[(yy * W + xx) * 4 + 3]) edge = true; }
      if (edge && def.opts.outline !== false) { d.data[i] = on >> 16; d.data[i + 1] = on >> 8 & 255; d.data[i + 2] = on & 255; d.data[i + 3] = 255; } else d.data[i + 3] = 0;
    }
    x.putImageData(d, 0, 0);
    // silhouette variant
    const s = mk(W, H), sx = s.getContext('2d'); sx.drawImage(c, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#0d0c0c'; sx.fillRect(0, 0, W, H);
    SPRITES[name] = { img: c, sil: s, w: W, h: H };
    return SPRITES[name];
  }
  const sprite = (n) => SPRITES[n] || buildSprite(n);
  /** Register a raster image (e.g. a ChatGPT-generated PNG with transparency) as a sprite. */
  function registerImageSprite(name, img, { pixel = 0 } = {}) {
    let src = img;
    if (pixel > 0) { // re-pixelate a smooth image down to a chunky grid
      const gw = Math.max(1, Math.round(img.width / pixel)), gh = Math.max(1, Math.round(img.height / pixel)), c = mk(gw, gh), x = c.getContext('2d');
      x.drawImage(img, 0, 0, gw, gh); src = c;
    }
    const W = src.width, H = src.height, s = mk(W, H), sx = s.getContext('2d');
    sx.drawImage(src, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#0d0c0c'; sx.fillRect(0, 0, W, H);
    SPRITES[name] = { img: src, sil: s, w: W, h: H };
  }

  // ───────────────────────────── drawing kit ─────────────────────────────
  function kit(film, ctx) {
    const W = film.w, H = film.h, U = Math.min(W, H) / 1080; // U = unit: 1 px on a 1080-px short side (landscape 1440×1080 and portrait 1080×1920 both get U=1)
    const g = {
      film, C, W, H, U, ctx, ease, clamp, lerp, rng, noise1, stepped,

      /** Fill the frame with a world colour. */
      bg(world = 'paper') { ctx.fillStyle = WORLD_BG[world] || world; ctx.fillRect(0, 0, W, H); },

      /** Run fn with save/restore and optional transform + filter + alpha. */
      layer(o, fn) {
        ctx.save();
        if (o.alpha != null) ctx.globalAlpha *= o.alpha;
        if (o.blend) ctx.globalCompositeOperation = o.blend;
        if (o.blur) ctx.filter = `blur(${o.blur * U}px)`;
        if (o.x != null || o.y != null) ctx.translate(o.x || 0, o.y || 0);
        if (o.rot) ctx.rotate(o.rot);
        if (o.sx != null || o.sy != null || o.scale != null) ctx.scale((o.sx ?? 1) * (o.scale ?? 1), (o.sy ?? 1) * (o.scale ?? 1));
        fn(ctx); ctx.restore();
      },

      /** Directional motion blur: renders fn `n` times along (dx,dy) at falling alpha. */
      motionBlur(dx, dy, fn, n = 8) {
        const mag = Math.hypot(dx, dy);
        if (mag < 1) return fn(ctx);
        for (let i = 0; i < n; i++) {
          const k = i / (n - 1) - .5;
          ctx.save(); ctx.globalAlpha *= 1.6 / n; ctx.translate(dx * k, dy * k); fn(ctx); ctx.restore();
        }
      },

      // ─────────── type ───────────
      font(size, weight = 500) { return `${weight} ${size * U}px ${film.font ? `"${film.font}", ` : ''}${FONT}`; },
      measure(str, size, weight = 500, track = 0) { ctx.save(); ctx.font = g.font(size, weight); const w = ctx.measureText(str).width + track * size * U * str.length; ctx.restore(); return w; },
      /** Draw text. size is in 1080p px. Returns width. */
      text(str, x, y, o = {}) {
        const size = o.size || 25, weight = o.weight || 500;
        ctx.save();
        ctx.font = g.font(size, weight); ctx.textBaseline = o.baseline || 'middle'; ctx.textAlign = o.align || 'left';
        if (o.track) ctx.letterSpacing = `${o.track * size * U}px`;
        ctx.globalAlpha *= o.alpha ?? 1;
        const col = o.color || C.ink;
        // ink spread: faint blurred copy under crisp copy
        if (o.soft !== false) { ctx.filter = `blur(${(o.blur ?? .6) * U}px)`; ctx.fillStyle = col; ctx.fillText(str, x, y); }
        ctx.filter = o.blur > 1 ? `blur(${o.blur * U}px)` : 'none';
        if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 14 * U; }
        ctx.fillStyle = col; ctx.fillText(str, x, y);
        const w = ctx.measureText(str).width; ctx.restore(); return w;
      },
      /**
       * Word-by-word sentence. words: array of strings; times: reveal time (s) per word.
       * New words arrive grey/transparent and settle over `settle` s.
       * o.highlight = {index: color}. Returns {x, w, positions[]} for anchoring.
       */
      words(words, times, t, x, y, o = {}) {
        const size = o.size || 25, weight = o.weight || 500, space = g.measure(' ', size, weight);
        let cx = x; const pos = [];
        words.forEach((wd, i) => {
          const w = g.measure(wd, size, weight); pos.push({ x: cx, w });
          const age = t - times[i];
          if (age >= 0) {
            const k = clamp(age / (o.settle ?? .1));
            const col = (o.highlight && o.highlight[i]) || o.color || C.ink;
            g.text(wd, cx, y, { size, weight, color: col, alpha: lerp(.45, 1, k), blur: o.blur });
          }
          cx += w + space;
        });
        return { x, w: cx - x - space, positions: pos };
      },
      /** Text cursor. mode 'block' (wide, solid) or 'bar' (thin, blinking). */
      cursor(x, y, size = 25, t = 0, mode = 'bar', color = C.white) {
        const h = size * 1.15 * U;
        if (mode === 'bar' && Math.floor(t * 4) % 2) return;
        ctx.save(); ctx.fillStyle = color; ctx.globalAlpha *= .92;
        const w = mode === 'block' ? size * .62 * U : Math.max(2, size * .09 * U);
        ctx.fillRect(x, y - h / 2, w, h); ctx.restore();
      },
      /** Dashed guide lines across the full width (hero word). */
      guides(ys, o = {}) {
        ctx.save(); ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = (o.width || 2.4) * U; ctx.setLineDash([(o.dash || 22) * U, (o.gap || 16) * U]);
        ctx.lineDashOffset = -(o.offset || 0) * U; ctx.globalAlpha *= o.alpha ?? .9;
        ys.forEach(y => { ctx.beginPath(); ctx.moveTo(o.x0 ?? 0, y); ctx.lineTo(o.x1 ?? W, y); ctx.stroke(); });
        ctx.restore();
      },
      /** Dotted text-selection box with I-beam handles at both ends. */
      selectBox(x, y, w, h, o = {}) {
        ctx.save(); ctx.strokeStyle = o.color || C.ink; ctx.globalAlpha *= o.alpha ?? .8; ctx.lineWidth = 1.6 * U; ctx.setLineDash([3 * U, 4 * U]);
        ctx.strokeRect(x, y, w, h); ctx.setLineDash([]); ctx.lineWidth = 2.6 * U;
        for (const X of [x, x + w]) { ctx.beginPath(); ctx.moveTo(X, y - 4 * U); ctx.lineTo(X, y + h + 4 * U); ctx.moveTo(X - 6 * U, y - 4 * U); ctx.lineTo(X + 6 * U, y - 4 * U); ctx.moveTo(X - 6 * U, y + h + 4 * U); ctx.lineTo(X + 6 * U, y + h + 4 * U); ctx.stroke(); }
        ctx.restore();
      },
      /** Solid block that slides in to cover, then retracts (p: 0..1 → in, 1..2 → out). */
      blockWipe(x, y, w, h, p, color = '#151313') {
        const a = clamp(p), b = clamp(p - 1);
        ctx.fillStyle = color; ctx.fillRect(x + w * b, y, w * (a - b), h);
      },
      /** Huge sketchy letterform: the string stroked many times with jitter (pen sketch). */
      sketchText(str, x, y, size, f, o = {}) {
        const r = rng((o.seed || 7) + stepped(f, 2) * 31);
        ctx.save(); ctx.font = g.font(size, 600); ctx.textBaseline = 'alphabetic'; ctx.textAlign = o.align || 'center';
        ctx.strokeStyle = o.color || C.ink; ctx.lineJoin = 'round';
        for (let i = 0; i < (o.passes || 9); i++) {
          ctx.save(); ctx.lineWidth = r.range(1.5, 4) * U;
          ctx.setTransform(1 + r.range(-.04, .04), r.range(-.06, .06), r.range(-.25, .05), 1 + r.range(-.12, .18), x + r.range(-14, 14) * U, y + r.range(-20, 20) * U);
          ctx.strokeText(str, 0, 0); ctx.restore();
        }
        ctx.restore();
      },

      // ─────────── hand / ink layer ───────────
      /** Generate a scribble path. kind: 'signature' | 'zigzag' | 'spiral' | 'lasso' | 'hook' | 'underline' */
      scribblePath(kind, x, y, w, h, seed = 1) {
        const r = rng(seed), pts = [];
        if (kind === 'signature') {
          let cx = x; const n = 7;
          pts.push([x - w * .05, y + h * .3]);
          for (let i = 0; i < n; i++) {
            const lx = cx + w / n * .4, top = y - h * r.range(.2, .6), bot = y + h * r.range(.1, .4);
            pts.push([lx, top], [lx + w / n * .5, bot]); cx += w / n;
          }
          pts.push([x + w * 1.1, y - h * .7]);
        } else if (kind === 'zigzag') {
          const n = r.int(3, 5); for (let i = 0; i <= n; i++) pts.push([x + r.range(-.15, .15) * w + (i % 2) * w * .5, y + (i / n) * h]);
        } else if (kind === 'spiral') {
          for (let a = 0; a < Math.PI * 7; a += .25) { const rr = (1 - a / (Math.PI * 7)) * .5 + .1; pts.push([x + Math.cos(a) * w * rr + a * w * .01, y + Math.sin(a) * h * rr]); }
        } else if (kind === 'lasso') {
          for (let a = -.3; a < Math.PI * 2.35; a += .2) pts.push([x + Math.cos(a) * w * .5 * (1 + r.range(-.04, .04)), y + Math.sin(a) * h * .5 * (1 + r.range(-.08, .08)) + a * h * .03]);
        } else if (kind === 'hook') {
          pts.push([x, y - h * .5], [x + w * .1, y + h * .4], [x - w * .2, y + h * .5], [x - w * .3, y + h * .2]);
        } else { // underline
          pts.push([x, y], [x + w * .9, y - h * .1], [x + w * .75, y + h * .25], [x + w * 1.1, y + h * .1]);
        }
        return pts;
      },
      /** Write-on stroke along pts (Catmull-Rom smoothed), stepped on twos. p: 0..1 drawn, optional tail p0. */
      stroke(pts, p, o = {}) {
        if (pts.length < 2 || p <= 0) return;
        const sm = smooth(pts, 8), n = sm.length, end = Math.floor(clamp(p) * (n - 1)), start = Math.floor(clamp(o.p0 || 0) * (n - 1));
        if (end <= start) return;
        ctx.save(); ctx.strokeStyle = o.color || C.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const lw = (o.width || 2.4) * U;
        if (o.blur) ctx.filter = `blur(${o.blur * U}px)`;
        // pressure: thinner at ends
        for (let i = start + 1; i <= end; i++) {
          const k = (i - start) / Math.max(1, end - start), press = o.taper === false ? 1 : .45 + .55 * Math.sin(Math.PI * clamp(k * .9 + .05));
          ctx.lineWidth = lw * press; ctx.beginPath(); ctx.moveTo(sm[i - 1][0], sm[i - 1][1]); ctx.lineTo(sm[i][0], sm[i][1]); ctx.stroke();
        }
        ctx.restore();
      },
      /** Big soft calligraphy brush smear (transition). Grey motion-smeared body + dark core line. */
      brushSmear(pts, p, o = {}) {
        const w = (o.width || 46);
        g.stroke(pts, p, { color: 'rgba(40,36,36,.35)', width: w, blur: w * .45, taper: true, p0: o.p0 });
        g.stroke(pts, p, { color: 'rgba(40,36,36,.25)', width: w * .55, blur: 6, p0: o.p0 });
        g.stroke(pts, p, { color: o.color || '#1b1818', width: o.core || 4.5, p0: o.p0, blur: .6 });
      },
      /** Airbrush spray blot. grow: 0..1. Dense core + speckled spray edge. */
      sprayBlot(x, y, r, grow, seed = 3, o = {}) {
        if (grow <= 0) return;
        const R = r * U * ease.out(grow), rr = rng(seed);
        const sx = o.sx ?? rr.range(.8, 1.5), rot = o.rot ?? rr.range(0, Math.PI);
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, 1);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        (o.hard ? [[0, .99], [.7, .99], [.76, .7], [.82, .12], [.84, 0]] : [[0, .98], [.55, .92], [.8, .35], [1, 0]]).forEach(([k, al]) => gr.addColorStop(k, `rgba(10,9,9,${al})`)); // hard: solid core to 70 %, short falloff
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0c0b0b';
        const n = Math.floor((o.hard ? 900 : 260) * grow), sr = rng(seed * 7);
        for (let i = 0; i < n; i++) { const a = sr() * Math.PI * 2, d = R * (o.hard ? .74 + sr() * .2 : .7 + Math.pow(sr(), 2) * .7), s = sr.range(.6, 2.2) * U; ctx.globalAlpha = sr.range(.3, .9); ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, s, s); }
        ctx.restore();
      },
      /** Ink droplets/flecks scattered around (life on twos). */
      flecks(n, seed, f, o = {}) {
        const r = rng(seed + stepped(f, 2) * 13);
        ctx.save(); ctx.fillStyle = o.color || '#151212';
        for (let i = 0; i < n; i++) {
          const x = r() * W, y = r() * H, l = r.range(3, 14) * U, a = r() * Math.PI;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, l, r.range(.8, 2.2) * U, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        ctx.restore();
      },
      /** Radial splatter hit — sharp tapered spikes. */
      splatter(x, y, r, seed = 5, o = {}) {
        const rr = rng(seed), n = o.n || rr.int(6, 10);
        ctx.save(); ctx.fillStyle = o.color || C.splat; ctx.translate(x, y);
        if (o.glow !== false) { const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * U * .7); gr.addColorStop(0, 'rgba(240,170,40,.85)'); gr.addColorStop(1, 'rgba(240,170,40,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * U * .7, 0, 7); ctx.fill(); ctx.fillStyle = o.color || C.splat; }
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rr.range(-.3, .3), d0 = r * U * rr.range(.35, .55), d1 = r * U * rr.range(.9, 1.4), wd = rr.range(2, 5) * U;
          ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(d0, -wd); ctx.lineTo(d1, 0); ctx.lineTo(d0, wd); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        ctx.restore();
      },
      /** Thin red pen loops orbiting a point, redrawn every 2 frames. */
      redLoops(x, y, r, f, seed = 1, o = {}) {
        const rr = rng(seed * 97 + stepped(f, 2) * 5), loops = o.loops || 2;
        ctx.save(); ctx.strokeStyle = o.color || C.red; ctx.lineWidth = (o.width || 1.4) * U; ctx.globalAlpha *= .9;
        for (let k = 0; k < loops; k++) {
          const a0 = rr() * 6.28, rx = r * U * rr.range(.6, 2.2), ry = r * U * rr.range(.3, 1), rot = rr() * 6.28, cx = x + rr.range(-.4, .4) * r * U, cy = y + rr.range(-.4, .4) * r * U;
          ctx.beginPath();
          for (let a = 0; a <= 6.5; a += .12) { const px = cx + Math.cos(a + a0) * rx * (1 + .15 * Math.sin(a * 3)), py = cy + Math.sin(a + a0) * ry; const X = x + (px - x) * Math.cos(rot) - (py - y) * Math.sin(rot), Y = y + (px - x) * Math.sin(rot) + (py - y) * Math.cos(rot); a ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
          ctx.stroke();
        }
        ctx.restore();
      },
      /** Horizontal speed streaks (red dashes) during a pan. */
      streaks(n, seed, f, o = {}) {
        const r = rng(seed + stepped(f, 1) * 3);
        ctx.save(); ctx.fillStyle = o.color || C.red;
        for (let i = 0; i < n; i++) { const y = r() * H, x = r() * W, l = r.range(200, 420) * U, h = r.range(2, 3.2) * U; ctx.globalAlpha = o.alpha ?? r.range(.25, .7); ctx.fillRect(x, y, l, h); }
        ctx.restore();
      },

      // ─────────── pixel objects ───────────
      /**
       * Draw a sprite centred at x,y. size = height in 1080p px.
       * o: rot, squash (0..1 horizontal turn), silhouette (0..1), blur, alpha, flip, bloom.
       */
      sprite(name, x, y, size, o = {}) {
        const sp = sprite(name), s = (size * U) / sp.h;
        ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
        ctx.scale(s * (o.flip ? -1 : 1) * (1 - (o.squash || 0)), s);
        ctx.imageSmoothingEnabled = false; ctx.globalAlpha *= o.alpha ?? 1;
        if (o.blur) ctx.filter = `blur(${o.blur * U / s}px)`;
        if (o.bloom !== false) { ctx.save(); ctx.filter = `blur(${2 * U / s}px)`; ctx.globalAlpha *= .35; ctx.drawImage(sp.img, -sp.w / 2, -sp.h / 2); ctx.restore(); }
        ctx.drawImage(sp.img, -sp.w / 2, -sp.h / 2);
        if (o.silhouette) { ctx.globalAlpha *= clamp(o.silhouette); ctx.drawImage(sp.sil, -sp.w / 2, -sp.h / 2); }
        ctx.restore();
        return { w: sp.w * s, h: sp.h * s };
      },
      spriteAspect(name) { const sp = sprite(name); return sp.w / sp.h; },
      /** Ellipse carousel of sprites. rot: radians of carousel spin. Back items drawn first. */
      carousel(names, cx, cy, rx, ry, rot, o = {}) {
        const items = names.map((n, i) => { const a = rot + (i / names.length) * Math.PI * 2; return { n, i, a, z: Math.sin(a) }; }).sort((a, b) => a.z - b.z);
        items.forEach(it => {
          if (o.skip && o.skip(it.i)) return;
          const persp = lerp(o.back ?? .78, o.front ?? 1.2, (it.z + 1) / 2), x = cx + Math.cos(it.a) * rx * U, y = cy + Math.sin(it.a) * ry * U;
          const per = o.per ? o.per(it.i, x, y) : {};
          g.sprite(it.n, x + (per.dx || 0), y + (per.dy || 0), (o.size || 150) * persp * (per.scale ?? 1), { rot: (per.rot || 0) + Math.cos(it.a) * .12, ...per.opts });
        });
      },

      // ─────────── light ───────────
      /** Astroid four-point star path (|x|^⅔+|y|^⅔=1) with sharpness k (>1 thinner points). */
      starPath(x, y, rx, ry, rot = 0, k = 1) {
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) { const t = i / 160 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); const px = Math.sign(c) * Math.pow(Math.abs(c), 3 * k) * rx, py = Math.sign(s) * Math.pow(Math.abs(s), 3 * k) * ry; const X = x + px * Math.cos(rot) - py * Math.sin(rot), Y = y + px * Math.sin(rot) + py * Math.cos(rot); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.closePath();
      },
      /** Hard four-point sparkle with glow. */
      sparkle(x, y, r, o = {}) {
        ctx.save(); ctx.fillStyle = o.color || C.red; ctx.shadowColor = o.glowColor || o.color || C.red; ctx.shadowBlur = (o.glow ?? 18) * U;
        g.starPath(x, y, r * U * (o.ax ?? 1), r * U * (o.ay ?? 1), o.rot || 0, o.k || 1); ctx.fill(); ctx.restore();
      },
      /**
       * Huge star filled with stochastic dot dither + glowing rim.
       * colors: [inner, rim]. density 0..1. Seeded per frame on twos for boil.
       */
      ditherStar(x, y, rx, ry, rot, f, o = {}) {
        const key = 'ds' + Math.round(rx) + '_' + Math.round(ry) + (o.colors || []).join() + (o.density || '') + stepped(f, 2) % 6;
        let tile = film._cache[key];
        const w = Math.ceil(rx * 2 * U), h = Math.ceil(ry * 2 * U);
        if (!tile) {
          tile = mk(w, h); const x2 = tile.getContext('2d'), k = g.__swap(x2);
          g.starPath(w / 2, h / 2, w / 2, h / 2, 0, o.k || 1); g.__swap(k); x2.save(); x2.clip();
          const cols = o.colors || [C.redDeep, C.red], dens = o.density ?? .5, r = rng(11 + stepped(f, 2) % 6);
          x2.fillStyle = cols[0]; x2.globalAlpha = o.base ?? .25; x2.fillRect(0, 0, w, h); x2.globalAlpha = 1;
          const n = Math.floor(w * h * .02 * dens);
          for (let i = 0; i < n; i++) { const px = r() * w, py = r() * h, d = Math.hypot((px - w / 2) / (w / 2), (py - h / 2) / (h / 2)); x2.fillStyle = r() < d * .9 ? cols[1] : cols[0]; const s = (r() < .5 ? 2 : 3) * U; x2.fillRect(px, py, s, s); }
          x2.restore();
          if (o.rim) { x2.save(); x2.shadowColor = o.rim; x2.strokeStyle = o.rim; const k3 = g.__swap(x2); g.starPath(w / 2, h / 2, w / 2 - 3, h / 2 - 3, 0, o.k || 1); g.__swap(k3); x2.save(); x2.filter = `blur(${(o.rimBlur || 12) * U}px)`; x2.globalAlpha = .6; x2.lineWidth = 10 * U; x2.stroke(); x2.restore(); x2.lineWidth = 3.5 * U; const k2 = g.__swap(x2); g.starPath(w / 2, h / 2, w / 2 - 3, h / 2 - 3, 0, o.k || 1); g.__swap(k2); x2.stroke(); x2.restore(); }
          film._cache[key] = tile;
        }
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= o.alpha ?? 1; ctx.drawImage(tile, -w / 2, -h / 2); ctx.restore();
      },
      __swap(newCtx) { const old = ctx; ctx = newCtx; g.ctx = newCtx; return old; },
      /** Soft radial glow disc. */
      glow(x, y, r, color = C.red, a = 1) {
        const R = r * U, gr = ctx.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, hexA(color, a)); gr.addColorStop(.45, hexA(color, a * .7)); gr.addColorStop(1, hexA(color, 0));
        ctx.save(); ctx.fillStyle = gr; ctx.fillRect(x - R, y - R, R * 2, R * 2); ctx.restore();
      },
      /** Flat hard-edged light beam from (x0,y0) toward angle, width w0→w1, extended by p. */
      beam(x0, y0, ang, len, w0, w1, p = 1, color = C.red) {
        const L = len * U * ease.out(p), c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c;
        ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16 * U; ctx.beginPath();
        ctx.moveTo(x0 + nx * w0 * U / 2, y0 + ny * w0 * U / 2); ctx.lineTo(x0 + c * L + nx * w1 * U / 2, y0 + s * L + ny * w1 * U / 2);
        ctx.lineTo(x0 + c * L - nx * w1 * U / 2, y0 + s * L - ny * w1 * U / 2); ctx.lineTo(x0 - nx * w0 * U / 2, y0 - ny * w0 * U / 2); ctx.closePath(); ctx.fill(); ctx.restore();
      },
      /** Projector light pool on paper: dark falloff + hot ellipse. */
      lightPool(x, y, rx, ry, dark = .55) {
        ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
        const R = rx * U, gr = ctx.createRadialGradient(0, 0, R * .25, 0, 0, R * 1.6);
        [[0, 'rgba(245,245,243,.3)'], [.25, 'rgba(245,245,243,.1)'], [.45, 'rgba(12,10,10,0)'], [.7, `rgba(12,10,10,${dark * .55})`], [1, `rgba(12,10,10,${dark})`]].forEach(([k, c]) => gr.addColorStop(k, c));
        ctx.fillStyle = gr; ctx.fillRect(-W * 3, -H * 3, W * 6, H * 6); ctx.restore();
      },

      // ─────────── thermal silhouettes ───────────
      /**
       * Thermal-glow silhouette. shapeFn(ctx2) fills a white shape in a 1440×1080 space.
       * heat 0..1 (0 = blurred dull red entry, 1 = full hot gradient), blur extra px.
       */
      thermal(shapeFn, o = {}) {
        const sc = .5, w = Math.ceil(W * sc), h = Math.ceil(H * sc), key = 'th_' + (o.key || 'x') + '_' + (o.frameKey ?? '');
        let out = film._cache[key];
        if (!out) {
          const m = mk(w, h), mx = m.getContext('2d'); mx.scale(sc * W / 1440, sc * H / 1080); mx.fillStyle = '#fff'; shapeFn(mx);
          const b = mk(w, h), bx = b.getContext('2d'); bx.filter = `blur(${(o.core || 60) * sc}px)`; bx.drawImage(m, 0, 0);
          const md = mx.getImageData(0, 0, w, h).data, bd = bx.getImageData(0, 0, w, h), d = bd.data;
          const lut = thermalLUT(o.palette);
          for (let i = 0; i < d.length; i += 4) {
            const inside = md[i + 3] / 255, v = clamp(((d[i + 3] / 255) - .55) / .45 + (o.bias || 0)), j = Math.floor(Math.pow(v, 1.15) * 255) * 3;
            d[i] = lut[j]; d[i + 1] = lut[j + 1]; d[i + 2] = lut[j + 2]; d[i + 3] = inside * 255;
          }
          bx.filter = 'none'; bx.putImageData(bd, 0, 0); out = b; film._cache[key] = out;
        }
        const heat = o.heat ?? 1;
        ctx.save(); ctx.imageSmoothingEnabled = true;
        // outer halation
        ctx.filter = `blur(${(18 + (1 - heat) * 30) * U}px)`; ctx.globalAlpha *= .3; ctx.drawImage(out, 0, 0, W, H); ctx.globalAlpha /= .3;
        ctx.filter = `blur(${(.5 + (o.blur || 0) + (1 - heat) * 26) * U}px)` + (heat < 1 ? ` hue-rotate(${-(1 - heat) * 25}deg) saturate(${1 + (1 - heat)})` : '');
        ctx.globalAlpha *= o.alpha ?? 1; ctx.drawImage(out, 0, 0, W, H);
        ctx.restore();
      },
      /** Flat cut-out version of a shape (the exposure-wash moment): olive fill, warm edge. */
      cutout(shapeFn, o = {}) {
        ctx.save(); ctx.scale(W / 1440, H / 1080);
        ctx.save(); ctx.translate(8, 6); ctx.fillStyle = o.edge || '#8a5a2e'; shapeFn(ctx); ctx.restore();
        ctx.fillStyle = o.color || C.olive; shapeFn(ctx); ctx.restore();
      },
      /** Thin ring orbiting through a subject: back half drawn before, front half after the subject. */
      orbit(x, y, rx, ry, tilt, p, which = 'front', o = {}) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.strokeStyle = o.color || C.white; ctx.lineCap = 'round';
        ctx.shadowColor = o.color || C.white; ctx.shadowBlur = 8 * U;
        const head = -Math.PI * .5 + p * Math.PI * 2.2, tail = head - (o.len || 2.6);
        for (let a = tail; a < head; a += .03) {
          const front = Math.sin(a) > 0; if ((which === 'front') !== front) continue;
          const k = (a - tail) / (head - tail); ctx.globalAlpha = k; ctx.lineWidth = (o.width || 3) * U * (.4 + k * .6);
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * rx * U, Math.sin(a) * ry * U); ctx.lineTo(Math.cos(a + .035) * rx * U, Math.sin(a + .035) * ry * U); ctx.stroke();
        }
        ctx.restore();
      },
    };
    KIT_EXT.forEach(ext => ext(g, film));
    return g;
  }
  const KIT_EXT = [];

  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }
  const LUTS = {};
  function thermalLUT(stops) {
    stops = stops || [[0, '#5a0a06'], [.18, '#C41E14'], [.4, '#F2541A'], [.62, '#FF8A1E'], [.8, '#FFC04A'], [.93, '#FFE9B8'], [1, '#FFF8EC']];
    const key = JSON.stringify(stops); if (LUTS[key]) return LUTS[key];
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = i / 255; let j = 0; while (j < stops.length - 2 && v > stops[j + 1][0]) j++;
      const [a, ca] = stops[j], [b, cb] = stops[j + 1], t = clamp((v - a) / (b - a));
      const A = parseInt(ca.slice(1), 16), B = parseInt(cb.slice(1), 16);
      lut[i * 3] = lerp(A >> 16, B >> 16, t); lut[i * 3 + 1] = lerp(A >> 8 & 255, B >> 8 & 255, t); lut[i * 3 + 2] = lerp(A & 255, B & 255, t);
    }
    return (LUTS[key] = lut);
  }
  function smooth(pts, seg) { // Catmull-Rom
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (let s = 0; s < seg; s++) { const t = s / seg, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))); }
    }
    out.push(pts[pts.length - 1]); return out;
  }

  // ───────────────────────────── film ─────────────────────────────
  function film(canvas, opts = {}) {
    const w = opts.w || 1440, h = opts.h || 1080, fps = opts.fps || 24;
    canvas.width = w; canvas.height = h;
    const out = canvas.getContext('2d'), scene = mk(w, h), sctx = scene.getContext('2d'), acc = mk(w, h), actx = acc.getContext('2d');
    const F = {
      w, h, fps, shots: [], _cache: {}, subframes: opts.subframes || 1, font: opts.font || null,
      // camera: float = handheld drift amplitude (1080p px), push = default scale gain across each shot
      camera: Object.assign({ float: 0, rot: 0, push: 0 }, opts.camera || {}),
      treatment: Object.assign({ grain: true, vignette: true, flicker: true, weave: true, specks: true, halation: true }, opts.treatment || {}),
      /** o: { push, camera:false, blur:(s)=>px, paperTreatment } */
      shot(dur, world, draw, o = {}) { F.shots.push({ dur, world, draw, o, seed: F.shots.length * 7919 + 17 }); return F; },
      get duration() { return F.shots.reduce((a, s) => a + s.dur, 0); },
      get frames() { return Math.round(F.duration * fps); },
      atTime(T) { let acc = 0; for (let i = 0; i < F.shots.length; i++) { const s = F.shots[i]; if (T < acc + s.dur - 1e-9) return { s, i, t: T - acc, start: acc }; acc += s.dur; } const i = F.shots.length - 1, s = F.shots[i]; return { s, i, t: s.dur - 1e-6, start: acc - s.dur }; },
      at(fr) { return F.atTime(fr / fps); },
      shotStart(i) { let a = 0; for (let k = 0; k < i; k++) a += F.shots[k].dur; return a; },
      /** Draw shot i at local time t (camera included) into ctx2. Used for continuous handoffs. */
      drawShot(i, t, ctx2) {
        const s = F.shots[Math.max(0, Math.min(F.shots.length - 1, i))], g = kit(F, ctx2), T = F.shotStart(F.shots.indexOf(s)) + t;
        ctx2.save(); ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.globalAlpha = 1; ctx2.filter = 'none'; ctx2.globalCompositeOperation = 'source-over';
        g.bg(s.world);
        const st = { t, f: Math.round(t * fps), d: s.dur, p: t / s.dur, F: Math.round(T * fps), T, start: T - t, i: F.shots.indexOf(s), rnd: rng(s.seed) };
        if (s.o.camera !== false) F.applyCamera(ctx2, T, st, s);
        ctx2.save(); s.draw(g, st); ctx2.restore(); ctx2.restore();
      },
      applyCamera(c, T, st, s) {
        const cam = F.camera, push = s.o.push ?? cam.push, U = h / 1080;
        const k = 1 + push * st.p; // slow push across the shot
        const fx = cam.float * U * (noise1(T * .55, 11) + .5 * noise1(T * 1.3, 12)), fy = cam.float * U * (noise1(T * .5, 13) + .5 * noise1(T * 1.2, 14));
        const r = (cam.rot || 0) * Math.PI / 180 * noise1(T * .4, 15);
        c.translate(w / 2 + fx, h / 2 + fy); c.rotate(r); c.scale(k, k); c.translate(-w / 2, -h / 2);
      },
      _layers: [],
      /** Offscreen canvas pool for compositing helpers. */
      layer(n) { return F._layers[n] || (F._layers[n] = mk(w, h)); },
      renderTime(T) {
        const N = Math.max(1, F.subframes | 0);
        if (N === 1) { F.drawShot(F.atTime(T).i, F.atTime(T).t, sctx); }
        else {
          // true motion blur: average N sub-frames spread over a 180° shutter
          actx.setTransform(1, 0, 0, 1, 0, 0); actx.globalAlpha = 1; actx.clearRect(0, 0, w, h);
          const home = F.atTime(T), lo = home.start, hi = home.start + home.s.dur - 1e-4; // never sample across a shot boundary: cuts stay single-frame cuts
          for (let k = 0; k < N; k++) {
            const tt = Math.min(hi, Math.max(lo, T + (k / N - .5) * (.5 / fps))), a = F.atTime(Math.max(0, tt));
            F.drawShot(a.i, a.t, sctx);
            actx.globalAlpha = 1 / (k + 1); actx.drawImage(scene, 0, 0);
          }
          sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.globalAlpha = 1; sctx.drawImage(acc, 0, 0);
        }
        F.post(T, F.atTime(T));
      },
      renderFrame(fr) { F.renderTime(fr / fps); },
      post(Tm, at) {
        const s = at.s, T = F.treatment, fr = Math.round(Tm * 24); // film defects tick at 24 fps whatever the output rate
        const st = { t: at.t, p: at.t / s.dur, d: s.dur };
        const paper = s.world === 'paper' || s.o.paperTreatment;
        out.setTransform(1, 0, 0, 1, 0, 0); out.filter = 'none'; out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
        out.fillStyle = '#000'; out.fillRect(0, 0, w, h);
        const wx = T.weave ? noise1(fr * .15, 1) * 1.2 * h / 1080 : 0, wy = T.weave ? noise1(fr * .15, 2) * 1.2 * h / 1080 : 0;
        const fl = T.flicker ? 1 + clamp(noise1(fr * .9, 3) * .02 + (hash(fr * 31) - .5) * .02, -.028, .028) : 1; // ±3 % max per the bible
        out.filter = `brightness(${fl})` + (s.o.blur ? ` blur(${s.o.blur(st) * h / 1080}px)` : '');
        out.drawImage(scene, -4 + wx, -3 + wy, w + 8, h + 6); // oversize so weave never shows edges
        out.filter = 'none';
        if (T.halation && !paper) { out.save(); out.globalCompositeOperation = 'screen'; out.globalAlpha = .28; out.filter = `blur(${10 * h / 1080}px)`; out.drawImage(scene, 0, 0); out.restore(); }
        if (T.vignette) {
          const vg = out.createRadialGradient(w * .5 - 120 * h / 1080, h * .5 - 80 * h / 1080, 0, w * .5 - 120 * h / 1080, h * .5 - 80 * h / 1080, h * 1.08);
          const va = (s.o.vignette ?? 1) * (T.vignetteAmount ?? 1);
          if (paper) { [[0, 0], [.35, .012], [.55, .045], [.75, .11], [1, .21]].forEach(([k, a]) => vg.addColorStop(k, `rgba(40,36,38,${a * va})`)); }
          else { vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${.32 * va})`); }
          out.fillStyle = vg; out.fillRect(0, 0, w, h);
        }
        if (T.grain) {
          out.save(); out.globalCompositeOperation = 'overlay'; out.globalAlpha = (paper ? .16 : .22) * (T.grainAmount ?? 1);
          const tile = grainTile(fr % 8), pat = out.createPattern(tile, 'repeat'), ox = hash(fr) * 256, oy = hash(fr + 99) * 256;
          out.translate(-ox, -oy); out.fillStyle = pat; out.fillRect(0, 0, w + 256, h + 256); out.restore();
        }
        if (T.specks) {
          const r = rng(fr * 131 + 7), n = r.int(1, 6);
          out.save(); out.fillStyle = paper ? 'rgba(25,22,22,.75)' : 'rgba(235,230,225,.55)';
          for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h; if (r() < .6) { out.beginPath(); out.arc(x, y, r.range(.8, 2.4) * h / 1080, 0, 7); out.fill(); } else { out.save(); out.translate(x, y); out.rotate(r() * 3); out.fillRect(0, 0, r.range(3, 10) * h / 1080, h / 1080); out.restore(); } }
          out.restore();
        }
      },
      play() {
        const start = performance.now(), tick = () => { F.renderTime(((performance.now() - start) / 1000) % F.duration); requestAnimationFrame(tick); }; tick();
      },
    };
    return F;
  }

  function smoothClosed(c, pts, tension = .5) { // closed Catmull-Rom → cubic Béziers
    const n = pts.length; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n], t = tension / 3;
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
    }
    c.closePath();
  }
  // ───────────────────────────── silhouettes (generic, original) ─────────────────────────────
  // Shapes live in a 1440×1080 space. Fill with ctx.fill() inside.
  const SHAPES = {
    /** Generic profile head + shoulders facing left, centred at (cx, base at bottom). */
    profile(cx = 1000, top = 160, s = 1) {
      return (c) => {
        c.save(); c.translate(cx, top); c.scale(s, s); c.beginPath();
        c.moveTo(40, 0);
        c.bezierCurveTo(120, -20, 230, 10, 250, 90);   // crown → back of head
        c.bezierCurveTo(275, 170, 255, 260, 225, 330); // back of skull → nape
        c.bezierCurveTo(215, 380, 230, 430, 300, 480); // neck back → shoulder
        c.bezierCurveTo(380, 530, 420, 600, 430, 920); // shoulder → off frame
        c.lineTo(-210, 920);
        c.bezierCurveTo(-200, 700, -150, 610, -60, 560); // chest
        c.bezierCurveTo(-10, 530, 10, 480, 5, 420);      // throat
        c.bezierCurveTo(-25, 405, -40, 395, -45, 380);   // jaw
        c.bezierCurveTo(-55, 360, -50, 340, -60, 325);   // chin
        c.bezierCurveTo(-70, 312, -66, 300, -70, 290);   // lips
        c.bezierCurveTo(-78, 280, -72, 270, -76, 262);
        c.bezierCurveTo(-82, 250, -100, 232, -96, 218);  // nose tip
        c.bezierCurveTo(-90, 200, -70, 190, -66, 160);   // bridge
        c.bezierCurveTo(-64, 120, -60, 80, -30, 40);     // forehead
        c.bezierCurveTo(-10, 15, 10, 4, 40, 0);
        c.closePath(); c.fill();
        // tousled hair bumps
        [[14, -6, 30, .3], [62, -22, 44, -.4], [128, -18, 34, .6], [176, 2, 46, -.2], [232, 52, 28, .9], [-24, 30, 22, .1], [100, -36, 20, 1.2]].forEach(([x, y, r, a]) => { c.beginPath(); c.ellipse(x, y, r * 1.25, r * .8, a, 0, 7); c.fill(); });
        c.restore();
      };
    },
    /** Generic open hand reaching up from the bottom edge, fingers splayed. */
    /** Open right hand, palm to camera, rising from the bottom edge. A hand-traced outline smoothed with a closed
     *  Catmull-Rom spline (tapered fingers, curved webbing, thenar/hypothenar pads). `spread` fans the fingers. */
    hand(cx = 760, wristY = 1080, s = 1, spread = 1) {
      // [x, y] around the outline, clockwise from the forearm's left edge. Fingers: base → side → tip arc → side → web.
      const widen = (pts, f = 1.16) => { const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length; return pts.map(([x, y]) => [mx + (x - mx) * f, y]); };
      const fan = (pts0, pivot, ang) => widen(pts0).map(([x, y]) => { const dx = x - pivot[0], dy = y - pivot[1], c = Math.cos(ang), n = Math.sin(ang); return [pivot[0] + dx * c - dy * n, pivot[1] + dx * n + dy * c]; });
      const k = (spread - 1) * .5;
      const thumb = fan([[-150, -300], [-196, -352], [-232, -408], [-254, -458], [-262, -492], [-252, -514], [-230, -512], [-214, -488], [-196, -446], [-168, -404], [-134, -384]], [-140, -320], -k * .6);
      const index = fan([[-108, -440], [-120, -520], [-130, -600], [-136, -660], [-132, -690], [-116, -702], [-100, -692], [-96, -664], [-88, -594], [-76, -520], [-64, -462]], [-86, -450], -k * .35);
      const middle = fan([[-52, -468], [-54, -560], [-52, -652], [-50, -716], [-40, -744], [-20, -750], [-4, -734], [-2, -706], [2, -640], [6, -556], [12, -472]], [-20, -470], -k * .1);
      const ring = fan([[24, -470], [34, -548], [46, -618], [54, -670], [64, -692], [82, -694], [94, -678], [92, -650], [84, -594], [76, -526], [72, -458]], [50, -462], k * .2);
      const little = fan([[84, -446], [102, -496], [122, -548], [136, -586], [148, -604], [164, -604], [172, -588], [166, -560], [152, -514], [138, -466], [128, -420]], [108, -432], k * .45);
      const outline = [
        [-112, 140], [-104, 20], [-98, -90], [-102, -180], [-118, -240],   // forearm → wrist → thenar pad
        ...thumb, ...index, ...middle, ...ring, ...little,
        [132, -360], [126, -290], [108, -220], [100, -170], [104, -60], [114, 140],  // hypothenar → wrist → forearm
      ];
      return (c) => {
        c.save(); c.translate(cx, wristY); c.scale(s, s); smoothClosed(c, outline); c.fill(); c.restore();
      };
    },
  };

  root.PPM = { film, mk, hexA, thermalLUT, hash, extendKit: (fn) => KIT_EXT.push(fn), SPRITES, SPRITE_DEFS, C, ease, rng, noise1, stepped, defSprite, sprite, registerImageSprite, SHAPES, shade, clamp, lerp };
})(typeof window !== 'undefined' ? window : globalThis);
