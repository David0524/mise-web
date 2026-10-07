import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

/* The card that unfurls when the link is pasted into iMessage, WhatsApp or
   Slack. Next serves it at /opengraph-image and wires og:image / twitter:image
   into every page's <head> automatically (child routes inherit it).

   Fonts come off disk, not from Google: the build and the image must work with
   no network, and Satori can't read woff2, so public/fonts carries two static
   TTF cuts of the same Nunito the app ships (instanced from nunito.woff2). */
export const runtime = "nodejs";
export const alt = "Mise — plan the week with a chef who talks it through with you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F6EFE3";
const INK = "#221A15";
const BRICK = "#B44722";
const PLUM = "#573C56";

/* Her "happy" portrait — the same path data as components/MiseHello.jsx, so the
   face in the preview is the one they'll meet in the app. */
const MISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" color="${INK}">
<path d="M17 24c-3.4 0-5.6-2.6-4.8-5.6.6-2.3 3-3.4 5-2.7.2-3.2 2.9-5.5 6.2-5.2 1.3-2.9 4.6-4.3 7.8-3.3 2.4-2.2 6.3-1.9 8.3.7 2.6-.8 5.4.6 6.3 3.1 2.2-.4 4.3 1 4.7 3.2.5 2.8-1.7 5.4-4.9 5.4z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M17 24h28.6v4.2H17z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M20 28.4h23c0 8.6-.9 13.4-4.2 16.2-2 1.7-4.3 2.3-7.3 2.3s-5.3-.6-7.3-2.3C20.9 41.8 20 37 20 28.4z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
<circle cx="27.1" cy="37.4" r="1.85" fill="${INK}"/><circle cx="36.3" cy="37.4" r="1.85" fill="${INK}"/>
<path d="M28 41.8c1.6 2.1 5.5 2.1 7.1 0" stroke="${INK}" stroke-width="2.1" fill="none" stroke-linecap="round"/>
<path d="M25.6 46.8l6.4 5.2 6.4-5.2 3.1 1.5-9.5 7.4-9.5-7.4z" fill="${BRICK}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
<path d="M13 64c1.4-6.6 7-10.6 13.6-11.9L32 56l5.4-3.9C44 53.4 49.6 57.4 51 64z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M37.2 57.6l10.2 1.1-.5 4.1-10.2-1z" fill="#F0D9D5" stroke="${INK}" stroke-width="1.3"/>
</svg>`;

export default async function OpengraphImage() {
  const dir = path.join(process.cwd(), "public", "fonts");
  const [bold, semi] = await Promise.all([
    readFile(path.join(dir, "nunito-og-800.ttf")),
    readFile(path.join(dir, "nunito-og-600.ttf")),
  ]);
  const mise = `data:image/svg+xml;base64,${Buffer.from(MISE_SVG).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center",
        background: PAPER, fontFamily: "Nunito", color: INK, padding: "0 84px", position: "relative" }}>
        {/* A soft warm glow behind her, so the white portrait doesn't sit flat on the paper. */}
        <div style={{ position: "absolute", left: 40, top: 95, width: 440, height: 440, borderRadius: 999,
          background: "radial-gradient(circle, rgba(238,146,101,.35) 0%, rgba(238,146,101,0) 70%)", display: "flex" }} />
        <div style={{ width: 360, height: 360, borderRadius: 999, background: "#FFFFFF", display: "flex",
          alignItems: "flex-end", justifyContent: "center", flexShrink: 0, overflow: "hidden",
          boxShadow: "0 24px 60px rgba(34,26,21,.14)", border: `3px solid ${INK}` }}>
          {/* Sized so her shoulders run off the bottom of the circle, like a
              portrait, instead of stopping on a flat line inside it. */}
          <img src={mise} width={316} height={316} style={{ marginBottom: -4 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 72, flex: 1 }}>
          <div style={{ fontSize: 120, fontWeight: 800, color: BRICK, lineHeight: 1, letterSpacing: -2 }}>Mise</div>
          <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1.12, marginTop: 26, letterSpacing: -0.5 }}>
            Nobody needs a whole bunch of dill for one dish.
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: PLUM, lineHeight: 1.3, marginTop: 24 }}>
            Plan the week, shop for what gets used up, and cook it together.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Nunito", data: bold, weight: 800, style: "normal" },
        { name: "Nunito", data: semi, weight: 600, style: "normal" },
      ],
    }
  );
}
