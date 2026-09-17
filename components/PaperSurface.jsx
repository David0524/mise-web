"use client";

/* The app's background, drawn rather than photographed.
 *
 * Follows the hand-drawn-canvas-animation house rules, which are a direct
 * answer to how this surface kept failing:
 *
 *   "Paper, not screen. Never pure white, never pure black."
 *   "Texture is a finish, not a gradient. No createLinearGradient on the
 *    final canvas, no filter, no shadowBlur."
 *   "Seeded everything. Math.random is banned."
 *
 * Previous versions of this background were a 7.7 KB photograph (too flat to
 * see), then radial gradients under a brightness() filter (which matched the
 * paper exactly and vanished). A finish has neither failure mode: the marks
 * are real geometry at a chosen contrast, so they cannot silently become the
 * same colour as the page, and there is no asset to be low-quality.
 *
 * Drawn ONCE into a canvas and left alone. This is a static finish, not an
 * animation — a drawn frame costs 50-300ms in the reference films, which is
 * fine offline and absurd per-frame on a phone.
 */

import { useEffect, useRef } from "react";

function rng(seed) {
  let a = (seed * 1000003) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const parse = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const hex = (a) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const shade = (c, t) => hex(parse(c).map((v) => v * (1 - t)));

/* Draws the stock. Exported so the share-card renderer can print on the same
   paper as the app — one definition, the mistake the daylight gradient made
   by existing in two places. */
export function drawPaper(ctx, w, h, opts = {}) {
  const {
    stock = "#F6EFE3",
    seed = 5,
    bands = true,
    bandTint = "rgba(255,244,225,.5)",
    hatch = true,
    grainAlpha = 0.06,
  } = opts;

  ctx.fillStyle = stock;
  ctx.fillRect(0, 0, w, h);

  /* Diagonal light bands: the drawn equivalent of daylight across a counter.
     This replaced four radial gradients — same intent, but as geometry, so it
     survives at any size and can't be flattened by a filter. */
  if (bands) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = bandTint;
    const span = Math.hypot(w, h);
    for (let i = -10; i <= 10; i++) ctx.fillRect(-span, i * 150 - 38, span * 2, 76);
    ctx.restore();
  }

  /* A few long strokes, all along the light. Sparse on purpose: this is a
     background for reading over, and the house rule is one large thing beats
     twenty small ones. */
  if (hatch) {
    const r = rng(seed * 7 + 1);
    ctx.save();
    ctx.strokeStyle = shade(stock, 0.5);
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = 1;
    const n = Math.round((w * h) / 3600);
    for (let i = 0; i < n; i++) {
      const y = r() * h, len = 60 + r() * 220, x0 = r() * w;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + len * 0.92, y - len * 0.38);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Stock grain, the house recipe, scaled by area rather than a fixed count.
  const r2 = rng(seed);
  ctx.save();
  ctx.fillStyle = shade(stock, 0.5);
  ctx.globalAlpha = grainAlpha;
  const n = Math.round((w * h) / 420);
  for (let i = 0; i < n; i++) {
    ctx.fillRect(r2() * w, r2() * h, 1.6 * (0.4 + r2()), 1.6 * (0.4 + r2()));
  }
  ctx.restore();
}

export default function PaperSurface({ stock = "#F6EFE3", seed = 5, className = "surface" }) {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let raf = null;

    const paint = () => {
      raf = null;
      /* Capped DPR. At 3x on a large phone this is a 4-megapixel canvas of
         grain rects; 2 is indistinguishable here and a third of the work. */
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // 8% overscan top and bottom so the parallax has somewhere to travel
      const w = window.innerWidth, h = Math.round(window.innerHeight * 1.16);
      if (cv.width === Math.round(w * dpr) && cv.height === Math.round(h * dpr)) return;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      /* Guarded. A null 2D context is rare but real — a blocked canvas, a
         hardened browser, a memory-starved tab — and an unguarded call here
         would throw inside an effect and blank the whole app over a
         decoration. The CSS background-color on .surface is the fallback, so
         failing quietly costs the texture and nothing else. */
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPaper(ctx, w, h, { stock, seed });
    };

    paint();
    /* Only on resize, and coalesced. An orientation change or the mobile
       URL bar collapsing are the only things that should ever redraw this. */
    const onResize = () => { if (!raf) raf = requestAnimationFrame(paint); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [stock, seed]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
