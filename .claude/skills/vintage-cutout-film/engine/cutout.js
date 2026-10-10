/* vintage-cutout-film engine. One canvas, deterministic: frame f always draws the same pixels.
 *
 *   const film = await CF.film(canvas, SPEC, SCENES);   // SPEC: see references/spec.md
 *   film.renderFrame(f); film.frames; film.fps; film.play();
 *
 * Units: positions and sizes in a plate or scene are in frame heights (H = 1), origin at the frame centre,
 * +y down. So x runs about -0.67..0.67 on 4:3. Times are seconds.
 */
(function () {
  'use strict';
  const CF = (window.CF = {});

  // ---------- small maths ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    // the collage lurch: quick start, long settle
    lurch: (t) => 1 - Math.pow(1 - t, 4),
    soft: (t) => t * t * (3 - 2 * t),
  };
  CF.ease = ease; CF.clamp = clamp; CF.lerp = lerp;
  function rng(seed) { let a = (seed * 2654435761) >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; }
  CF.rng = rng;
  // keyframes [[t, v], ...] (t relative), easing between keys (default soft)
  function kf(keys, t, e = ease.soft) {
    if (typeof keys === 'number') return keys;
    if (typeof keys === 'function') return keys(t);
    if (!keys || !keys.length) return 0;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1, en] = keys[i]; return lerp(v0, v1, (ease[en] || e)((t - t0) / (t1 - t0 || 1))); }
    }
    return keys[keys.length - 1][1];
  }
  CF.kf = kf;

  // ---------- assets ----------
  async function loadImages(map, base = '') {
    const out = {};
    await Promise.all(Object.entries(map).map(([k, v]) => new Promise((ok, bad) => {
      const im = new Image(); im.onload = () => { out[k] = im; ok(); }; im.onerror = () => bad(new Error('image failed: ' + v)); im.src = base + (typeof v === 'string' ? v : v.src);
    })));
    return out;
  }
  // mip chain so a big cut-out drawn small (or blurred) costs little
  const mips = new Map();
  function mip(img, px) {
    let chain = mips.get(img);
    if (!chain) {
      chain = [img]; let cur = img;
      while (Math.max(cur.width, cur.height) > 160) {
        const c = document.createElement('canvas'); c.width = Math.max(1, cur.width >> 1); c.height = Math.max(1, cur.height >> 1);
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, c.width, c.height); chain.push(c); cur = c;
      }
      mips.set(img, chain);
    }
    let i = 0; while (i + 1 < chain.length && chain[i + 1].height >= px) i++;
    return chain[i];
  }

  // ---------- film ----------
  CF.film = async function (canvas, SPEC, SCENES = {}) {
    const [W, H] = SPEC.size || [1440, 1080], fps = SPEC.fps || 25;
    canvas.width = W; canvas.height = H;
    const out = canvas.getContext('2d');
    const work = document.createElement('canvas'); work.width = W; work.height = H;
    const ctx = work.getContext('2d');
    const imgs = await loadImages(SPEC.assets || {}, SPEC.base || '');
    const duration = SPEC.duration || Math.max(...SPEC.segments.map((s) => s.at + s.dur));
    const frames = Math.round(duration * fps);
    const T = Object.assign({ grain: 1, vignette: 1, flicker: 1, weave: 1, specks: 1, soft: 0.55 }, SPEC.treatment || {});
    const VOID = SPEC.void || '#191716';

    // grain tiles
    const tiles = [];
    for (let k = 0; k < 6; k++) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const d = g.createImageData(256, 256); const r = rng(101 + k);
      for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); tiles.push(c);
    }

    // ----- the drawing kit handed to scenes -----
    const g = {
      W, H, fps, ctx, imgs, ease, kf, lerp, clamp, rng,
      // screen <- unit coords
      sx: (x) => W / 2 + x * H, sy: (y) => H / 2 + y * H, px: (v) => v * H,
      background(color = VOID, pool = 0.06, px = 0, py = -0.05) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
        if (pool > 0) { const gr = ctx.createRadialGradient(g.sx(px), g.sy(py), 0, g.sx(px), g.sy(py), H * 0.75); gr.addColorStop(0, `rgba(255,236,220,${pool})`); gr.addColorStop(1, 'rgba(255,236,220,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
        ctx.restore();
      },
      // draw a cut-out: (x, y) centre, h height, all in H units
      image(name, x, y, h, o = {}) {
        const img = typeof name === 'string' ? imgs[name] : name; if (!img) throw new Error('missing image ' + name);
        const hp = h * H, wp = hp * img.width / img.height, blur = o.blur || 0;
        const src = mip(img, Math.max(8, hp / Math.max(1, blur / 3)));
        ctx.save();
        ctx.translate(g.sx(x), g.sy(y)); if (o.rot) ctx.rotate(o.rot * Math.PI / 180); if (o.flip) ctx.scale(-1, 1);
        const f = []; if (blur > 0.3) f.push(`blur(${blur.toFixed(2)}px)`); if (o.bright != null && o.bright !== 1) f.push(`brightness(${o.bright.toFixed(3)})`); if (o.contrast != null && o.contrast !== 1) f.push(`contrast(${o.contrast.toFixed(3)})`);
        ctx.filter = f.length ? f.join(' ') : 'none'; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
        const ax = o.ax == null ? 0.5 : o.ax, ay = o.ay == null ? 0.5 : o.ay;
        ctx.drawImage(src, -wp * ax, -hp * ay, wp, hp);
        ctx.restore();
        return { w: wp / H, h };
      },
      // soft elliptical light pool (a spotlight on a surface)
      pool(x, y, rx, ry, color = 'rgba(214,226,220,1)', alpha = 1, rot = 0, soft = 0.25) {
        ctx.save(); ctx.translate(g.sx(x), g.sy(y)); ctx.rotate(rot); ctx.scale(1, ry / rx); ctx.globalAlpha = alpha;
        const r = rx * H, gr = ctx.createRadialGradient(0, 0, r * (1 - soft), 0, 0, r); gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      },
      // vertical folds of warm light behind a product (the reveal's curtain)
      curtain(t, o = {}) {
        const { x0 = -0.35, x1 = 0.6, top = -0.5, bottom = 0.42, light = [244, 214, 190], amt = 1, seed = 3 } = o; const r = rng(seed);
        ctx.save();
        const L = g.sx(x0), R = g.sx(x1), Y0 = g.sy(top), Y1 = g.sy(bottom);
        const folds = 11;
        for (let i = 0; i < folds; i++) {
          const u = (i + 0.5) / folds, w = (R - L) / folds * (1.3 + r() * 1.2), cx = lerp(L, R, u) + Math.sin(t * 0.4 + i) * 4;
          const lum = (0.35 + 0.65 * Math.pow(Math.sin(u * Math.PI), 1.3)) * (0.55 + r() * 0.45) * amt;
          const gr = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
          const c = (a) => `rgba(${light[0]},${light[1]},${light[2]},${a})`;
          gr.addColorStop(0, c(0)); gr.addColorStop(0.35 + r() * 0.2, c(lum * 0.55)); gr.addColorStop(1, c(0));
          ctx.fillStyle = gr; ctx.fillRect(cx - w / 2, Y0, w, Y1 - Y0);
        }
        // fall-off to the floor and edges
        const v = ctx.createLinearGradient(0, Y0, 0, Y1); v.addColorStop(0, 'rgba(25,23,22,.15)'); v.addColorStop(0.75, 'rgba(25,23,22,0)'); v.addColorStop(1, 'rgba(25,23,22,.85)');
        ctx.fillStyle = v; ctx.fillRect(L - 200, Y0, R - L + 400, Y1 - Y0);
        ctx.restore();
      },
      // reflection of a cut-out on a glossy floor at y (H units)
      reflect(name, x, floorY, h, o = {}) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, g.sy(floorY), W, H); ctx.clip();
        ctx.translate(0, g.sy(floorY) * 2); ctx.scale(1, -1);
        g.image(name, x, floorY - h / 2 + (o.dy || 0), h, Object.assign({}, o, { alpha: o.alpha == null ? 0.22 : o.alpha, blur: o.blur == null ? 2.5 : o.blur }));
        ctx.restore();
        const fade = ctx.createLinearGradient(0, g.sy(floorY), 0, g.sy(floorY + 0.25)); fade.addColorStop(0, 'rgba(25,23,22,0)'); fade.addColorStop(1, 'rgba(25,23,22,1)');
        ctx.fillStyle = fade; ctx.fillRect(0, g.sy(floorY), W, H * 0.25 + 2);
      },
      // light sweeping across a cut-out: a bright band clipped to the image's alpha
      sweep(name, x, y, h, p, o = {}) {
        const img = imgs[name]; const hp = h * H, wp = hp * img.width / img.height;
        const c = g._tmp || (g._tmp = document.createElement('canvas')); c.width = W; c.height = H; const t = c.getContext('2d');
        t.clearRect(0, 0, W, H); t.save(); t.translate(g.sx(x), g.sy(y)); if (o.rot) t.rotate(o.rot * Math.PI / 180); t.drawImage(mip(img, hp), -wp / 2, -hp / 2, wp, hp); t.restore();
        t.globalCompositeOperation = 'source-in';
        const bw = wp * (o.width || 0.25), bx = lerp(g.sx(x) - wp, g.sx(x) + wp, p), gr = t.createLinearGradient(bx - bw, 0, bx + bw, hp * 0.3 * (o.width || 0.25) / 0.25);
        gr.addColorStop(0, 'rgba(255,240,222,0)'); gr.addColorStop(0.5, `rgba(255,240,222,${o.amt || 0.75})`); gr.addColorStop(1, 'rgba(255,240,222,0)');
        t.fillStyle = gr; t.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(c, 0, 0); ctx.restore();
      },
      // the end-card title: stacked retro display lines with bevel and glow. lines: [{text, size, dy}] in H units
      title(lines, x, y, o = {}) {
        const { color = '#EFE3CE', bevel = 0.0042, glow = 0.03, font = 'TitleSoft', reveal = lines.length, rot = 0 } = o;
        ctx.save(); ctx.translate(g.sx(x), g.sy(y)); ctx.rotate(rot * Math.PI / 180); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        let yy = 0;
        lines.forEach((L, i) => {
          yy += (L.gap != null ? L.gap : L.size * 0.86) * H;
          const a = clamp(reveal - i); if (a <= 0) return;
          ctx.font = `${Math.round(L.size * H)}px ${L.font || font}`; const tx = (L.dx || 0) * H;
          if (L.track) ctx.letterSpacing = `${L.track}em`; else ctx.letterSpacing = '0px';
          ctx.globalAlpha = a;
          ctx.save(); ctx.shadowColor = 'rgba(12,8,6,.75)'; ctx.shadowBlur = glow * H; ctx.fillStyle = 'rgba(30,20,14,.9)'; ctx.fillText(L.text, tx, yy); ctx.restore();
          const n = Math.max(2, Math.round(bevel * H));
          for (let k = n; k >= 1; k--) { ctx.fillStyle = k === n ? '#2a1d15' : '#5b4436'; ctx.fillText(L.text, tx + k * 0.8, yy + k); }
          const gr = ctx.createLinearGradient(0, yy - L.size * H * 0.75, 0, yy); gr.addColorStop(0, '#FBF3E4'); gr.addColorStop(1, color);
          ctx.fillStyle = L.color || gr; ctx.fillText(L.text, tx, yy);
        });
        ctx.restore();
      },
      // neon script line (Yellowtail): mint core, dark outline, soft glow
      script(text, x, y, size, o = {}) {
        const { rot = -6, color = '#D1FFF3', glowColor = 'rgba(80,220,190,.85)', alpha = 1, chars = text.length } = o;
        ctx.save(); ctx.translate(g.sx(x), g.sy(y)); ctx.rotate(rot * Math.PI / 180); ctx.globalAlpha = alpha;
        ctx.font = `${Math.round(size * H)}px Script`; ctx.textAlign = 'center'; const s = text.slice(0, Math.round(chars));
        ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,30,28,.9)'; ctx.lineWidth = size * H * 0.12; ctx.strokeText(s, 0, 0);
        ctx.shadowColor = glowColor; ctx.shadowBlur = size * H * 0.35; ctx.fillStyle = color; ctx.fillText(s, 0, 0); ctx.shadowBlur = size * H * 0.1; ctx.fillText(s, 0, 0);
        ctx.restore();
      },
      dust(f, n = 30, color = 'rgba(255,248,230,.5)', seed = 9) {
        const r = rng(seed); ctx.save(); ctx.fillStyle = color;
        for (let i = 0; i < n; i++) { const x0 = r() * W, y0 = r() * H, vx = (r() - 0.5) * 0.6, vy = (r() - 0.3) * 0.4, s = 0.6 + r() * 2.2; const x = ((x0 + vx * f) % W + W) % W, y = ((y0 + vy * f) % H + H) % H; ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(f * 0.07 + i)); ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      },
    };

    // ----- the plate stack (the litany) -----
    function buildStack(seg) {
      const P = seg.plates.map((p, j) => {
        const q = Object.assign({ enter: 0.5, pos: [0, 0.04], from: 'right', fromScale: 1.25, drift: seg.drift == null ? 0.028 : seg.drift }, p);
        // hole given in a piece's PNG pixels ({piece, px: [cx, cy, rx, ry]}, as printed by prep.py) -> plate units
        if (q.hole && !Array.isArray(q.hole)) {
          const pc = q.pieces[q.hole.piece || 0], img = imgs[pc.img], s = kf(pc.h || 0.8, 0) / img.height, [cx, cy, rx, ry] = q.hole.px;
          q.hole = [kf(pc.x || 0, 0) + (cx - img.width / 2) * s * (pc.flip ? -1 : 1), kf(pc.y || 0, 0) + (cy - img.height / 2) * s, rx * s, ry * s, q.hole.rot || 0];
        }
        if (q.hole) {
          if (!p.bg) q.bg = [q.pos[0] + q.hole[0], q.pos[1] + q.hole[1]];           // the old scene sits in the hole
          if (!p.k) q.k = Math.max(1.9, 0.95 / Math.min(q.hole[2], q.hole[3]));     // and the hole starts beyond the frame
          if (!p.from) q.from = 'camera';
          if (p.fromScale == null) q.fromScale = 1;
        }
        if (!q.k) q.k = j === 0 ? 1 : 1.9;
        if (!q.bg) q.bg = [-0.3, -0.06];
        return q;
      });
      // world scale Wj and centre Cj so that, when settled on j, plate j's centre is at pos_j and plate j-1's centre at bg_j
      let Wc = 1; const C = [[0, 0]];
      P.forEach((p, j) => {
        if (j === 0) { p.W = 1; p.C = [0, 0]; return; }
        Wc *= p.k; p.W = Wc;
        const prev = P[j - 1]; p.C = [prev.C[0] - (p.bg[0] - p.pos[0]) * Wc, prev.C[1] - (p.bg[1] - p.pos[1]) * Wc];
      });
      P.forEach((p) => { p.settle = p.at + p.enter; });
      return P;
    }
    function stackState(seg, P, t) {
      // which transition are we in?
      let j = 0; while (j + 1 < P.length && t >= P[j + 1].at) j++;
      const cur = P[j];
      if (j > 0 && t < cur.settle) {
        const prev = P[j - 1], e = ease[cur.ease || 'lurch'](clamp((t - cur.at) / cur.enter));
        const fPrev = 1 / (1 + prev.drift * Math.max(0, cur.at - prev.settle));
        const Z = Math.exp(lerp(Math.log(1 / prev.W), Math.log(1 / cur.W), e)) * lerp(fPrev, 1, e);
        const p = [lerp(prev.pos[0] * fPrev, cur.bg[0], e), lerp(prev.pos[1] * fPrev, cur.bg[1], e)];
        return { Z, cam: [prev.C[0] - p[0] / Z, prev.C[1] - p[1] / Z], u: j - 1 + e, j, e };
      }
      const f = 1 / (1 + cur.drift * Math.max(0, t - cur.settle));
      const Z = f / cur.W;
      return { Z, cam: [cur.C[0] - cur.pos[0] * f / Z, cur.C[1] - cur.pos[1] * f / Z], u: j, j, e: 1 };
    }
    const DIR = { right: [1, 0.05], left: [-1, 0.05], bottom: [0.05, 1], top: [0, -1], camera: [0, 0], 'bottom-right': [0.8, 0.7], 'bottom-left': [-0.8, 0.7] };
    function plateXf(seg, p, j, st, t) {
      // screen transform of plate j: unit point q -> screen sx = centre + ((C + q*W) - cam) * Z
      let s = p.W * st.Z, ox = (p.C[0] - st.cam[0]) * st.Z, oy = (p.C[1] - st.cam[1]) * st.Z;
      if (j > 0 && t < p.settle) {
        const e = ease[p.entryEase || 'out'](clamp((t - p.at) / p.enter));
        const d = Array.isArray(p.from) ? p.from : DIR[p.from] || DIR.right, dist = p.fromDist == null ? 0.95 : p.fromDist;
        ox += d[0] * dist * (1 - e); oy += d[1] * dist * (1 - e);
        s *= lerp(p.fromScale, 1, e);
      }
      const fl = seg.float == null ? 0.004 : seg.float;
      ox += Math.sin(t * 0.7 + 1.3) * fl; oy += Math.sin(t * 0.53) * fl * 0.8;
      return { s, ox, oy };
    }
    function drawPiece(pc, X, tl, look) {
      const img = imgs[pc.img]; if (!img) throw new Error('missing image ' + pc.img);
      const x = kf(pc.x || 0, tl), y = kf(pc.y || 0, tl), h = kf(pc.h || 0.8, tl), rot = kf(pc.rot || 0, tl);
      const cx = X.ox + x * X.s, cy = X.oy + y * X.s, hh = h * X.s;
      if (hh < 0.004) return;
      if (!pc.parts) { g.image(pc.img, cx, cy, hh, Object.assign({ rot, flip: pc.flip }, look)); return; }
      // hinged parts: polygons in image px with a pivot; the base is drawn with the parts cut away
      const hp = hh * H, wp = hp * img.width / img.height, k = hp / img.height;
      const toLocal = ([px, py]) => [(pc.flip ? -1 : 1) * (px * k - wp / 2), py * k - hp / 2];
      ctx.save(); ctx.translate(g.sx(cx), g.sy(cy)); ctx.rotate(rot * Math.PI / 180);
      const filt = []; if (look.blur > 0.3) filt.push(`blur(${look.blur.toFixed(2)}px)`); if (look.bright !== 1) filt.push(`brightness(${look.bright.toFixed(3)})`);
      const src = mip(img, Math.max(8, hp / Math.max(1, (look.blur || 0) / 3)));
      const blit = () => { ctx.save(); if (pc.flip) ctx.scale(-1, 1); ctx.drawImage(src, -wp / 2, -hp / 2, wp, hp); ctx.restore(); };
      ctx.filter = filt.length ? filt.join(' ') : 'none'; ctx.globalAlpha = look.alpha == null ? 1 : look.alpha;
      ctx.save(); ctx.beginPath(); ctx.rect(-wp * 2, -hp * 2, wp * 4, hp * 4); pc.parts.forEach((pt) => { pt.poly.map(toLocal).forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); }); ctx.clip('evenodd'); blit(); ctx.restore();
      pc.parts.forEach((pt) => {
        const [pvx, pvy] = toLocal(pt.pivot), ang = kf(pt.rot || 0, tl) * (pc.flip ? -1 : 1);
        ctx.save(); ctx.translate(pvx, pvy); ctx.rotate(ang * Math.PI / 180); ctx.translate(-pvx, -pvy);
        ctx.beginPath(); pt.poly.map(toLocal).forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.clip(); blit(); ctx.restore();
      });
      ctx.restore();
    }
    function drawStack(seg, t, f) {
      const P = seg._P || (seg._P = buildStack(seg));
      const st = stackState(seg, P, t);
      g.background(seg.void || VOID, seg.pool == null ? 0.05 : seg.pool);
      const visible = [];
      for (let j = 0; j <= Math.min(P.length - 1, st.j); j++) { const depth = st.u - j; if (depth < (P[j].keep || 2.9)) visible.push(j); }
      // portals: every plate older than a visible portal is drawn only inside its hole
      const X = {}; visible.forEach((j) => (X[j] = plateXf(seg, P[j], j, st, t)));
      const holePath = (j) => { const p = P[j], h = p.hole, x = X[j]; const cx = g.sx(x.ox + h[0] * x.s), cy = g.sy(x.oy + h[1] * x.s); ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.5, h[2] * x.s * H), Math.max(0.5, h[3] * x.s * H), (h[4] || 0) * Math.PI / 180, 0, Math.PI * 2); };
      for (const j of visible) {
        const p = P[j], depth = st.u - j, tl = t - p.at;
        // depth of field: near plates (depth < 0) blur hard, far plates a little; far plates dim
        const near = Math.max(0, -depth), far = Math.max(0, depth);
        const look = {
          blur: (near * (p.nearBlur || seg.nearBlur || 26) + far * (seg.farBlur == null ? 1.6 : seg.farBlur)) * (H / 1080),
          bright: 1 - Math.min(0.75, far * (seg.dim == null ? 0.34 : seg.dim)),
          alpha: clamp(((p.keep || 2.9) - depth) / 0.5),
        };
        ctx.save();
        visible.forEach((k) => { if (k > j && P[k].hole) { holePath(k); ctx.clip(); } });
        p.pieces.forEach((pc) => drawPiece(pc, X[j], tl, look));
        if (p.draw && SCENES[p.draw]) SCENES[p.draw](g, { t: tl, f, X: X[j], look, plate: p });
        ctx.restore();
      }
    }

    // ----- captions -----
    function caption(t) {
      const c = (SPEC.captions || []).find(([a, b]) => t >= a && t < b); if (!c) return;
      const lines = Array.isArray(c[2]) ? c[2] : String(c[2]).split('\n');
      const size = Math.round(H * (SPEC.captionSize || 0.043));
      out.save(); out.font = `${size}px Caption`; out.textAlign = 'center'; out.textBaseline = 'alphabetic';
      const base = H * (SPEC.captionBase || 0.948), lh = size * 1.1;
      lines.forEach((L, i) => {
        const y = base - (lines.length - 1 - i) * lh;
        out.shadowColor = 'rgba(0,0,0,.65)'; out.shadowBlur = size * 0.12; out.shadowOffsetX = size * 0.04; out.shadowOffsetY = size * 0.06;
        out.fillStyle = SPEC.captionColor || '#B9B65E'; out.fillText(L, W / 2, y);
      });
      out.restore();
    }

    // ----- film treatment -----
    function treat(f, t) {
      const r = rng(7919 * (f + 1));
      // weave + softness when moving the work canvas to the output
      const wv = T.weave * (H / 1080);
      const dx = (Math.sin(f * 0.37) + Math.sin(f * 0.11 + 2)) * 0.45 * wv, dy = (Math.sin(f * 0.29 + 1) + Math.sin(f * 0.07)) * 0.45 * wv;
      out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
      out.fillStyle = '#000'; out.fillRect(0, 0, W, H);
      out.filter = T.soft > 0 ? `blur(${(T.soft * H / 1080).toFixed(2)}px)` : 'none';
      out.drawImage(work, dx, dy); out.filter = 'none';
      // flicker
      const fl = (r() - 0.5) * 0.04 * T.flicker;
      if (fl > 0) { out.fillStyle = `rgba(255,240,225,${fl * 0.6})`; out.globalCompositeOperation = 'screen'; out.fillRect(0, 0, W, H); }
      else { out.fillStyle = `rgba(0,0,0,${-fl})`; out.globalCompositeOperation = 'source-over'; out.fillRect(0, 0, W, H); }
      // vignette
      out.globalCompositeOperation = 'multiply';
      const vg = out.createRadialGradient(W / 2, H * 0.47, H * 0.32, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, 'rgb(255,255,255)'); vg.addColorStop(1, `rgb(${Math.round(255 - 70 * T.vignette)},${Math.round(255 - 72 * T.vignette)},${Math.round(255 - 74 * T.vignette)})`);
      out.fillStyle = vg; out.fillRect(0, 0, W, H);
      // grain
      out.globalCompositeOperation = 'overlay'; out.globalAlpha = 0.16 * T.grain;
      const tile = tiles[f % tiles.length], ox = -Math.floor(r() * 256), oy = -Math.floor(r() * 256), sc = H / 1080 * 1.6;
      out.save(); out.scale(sc, sc); for (let y = oy; y < H / sc; y += 256) for (let x = ox; x < W / sc; x += 256) out.drawImage(tile, x, y); out.restore();
      // lifted blacks: nothing goes below the print's black (per-channel max)
      out.globalAlpha = 1; out.globalCompositeOperation = 'lighten'; out.fillStyle = SPEC.blackPoint || '#181512'; out.fillRect(0, 0, W, H);
      out.globalCompositeOperation = 'source-over';
      // specks (one frame each, rare)
      if (T.specks && r() < 0.11 * T.specks) {
        const n = 1 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) {
          const green = r() < 0.35; out.fillStyle = green ? 'rgba(110,230,130,.85)' : (r() < 0.5 ? 'rgba(250,244,230,.8)' : 'rgba(10,8,6,.7)');
          out.beginPath(); const x = r() * W, y = r() * H, s = (1 + r() * 3.5) * H / 1080; out.ellipse(x, y, s * (1 + r()), s, r() * 3, 0, Math.PI * 2); out.fill();
        }
      }
      // scheduled burns: [{at, dur, color, x, y}]
      for (const b of SPEC.burns || []) {
        if (t >= b.at && t < b.at + (b.dur || 0.08)) {
          out.globalCompositeOperation = 'screen'; const gr = out.createRadialGradient(g.sx(b.x || -0.2), g.sy(b.y || 0), 0, g.sx(b.x || -0.2), g.sy(b.y || 0), H * 1.1);
          gr.addColorStop(0, b.color || 'rgba(190,40,30,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); out.fillStyle = gr; out.fillRect(0, 0, W, H);
          out.globalCompositeOperation = 'multiply'; out.fillStyle = b.tint || 'rgba(230,120,110,1)'; out.globalAlpha = b.tintAmt == null ? 0.55 : b.tintAmt; out.fillRect(0, 0, W, H); out.globalAlpha = 1;
          out.globalCompositeOperation = 'source-over';
        }
      }
      out.restore();
    }

    // ----- timeline -----
    const segs = SPEC.segments.slice().sort((a, b) => a.at - b.at);
    function renderFrame(f) {
      const t = f / fps;
      let seg = segs[0]; for (const s of segs) if (t >= s.at) seg = s;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const st = { t: t - seg.at, T: t, f, p: clamp((t - seg.at) / seg.dur), dur: seg.dur, seg };
      if (seg.kind === 'stack') drawStack(seg, t, f);
      else if (seg.kind === 'black') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
      else { const fn = SCENES[seg.scene]; if (!fn) throw new Error('missing scene ' + seg.scene); fn(g, st); }
      if (seg.kind === 'black' && seg.raw !== false) { out.setTransform(1, 0, 0, 1, 0, 0); out.filter = 'none'; out.drawImage(work, 0, 0); }
      else treat(f, t);
      caption(t);
    }

    const film = {
      W, H, fps, frames, duration, renderFrame, g, spec: SPEC,
      play() { const t0 = performance.now(); const loop = () => { const f = Math.floor((performance.now() - t0) / 1000 * fps) % frames; renderFrame(f); film.raf = requestAnimationFrame(loop); }; loop(); },
      stop() { cancelAnimationFrame(film.raf); },
    };
    return film;
  };
})();
