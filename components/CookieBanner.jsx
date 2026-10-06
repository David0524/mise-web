"use client";
import { useEffect, useRef, useState } from "react";

/* The cookie banner. Mise only uses storage that's strictly necessary (the
   sign-in cookie, the app cache, your own settings), so nothing changes
   whichever button is pressed today — the banner says so rather than pretend
   otherwise. It exists so the choice is recorded before anything optional is
   ever added, and both answers get equal weight: same size, same style, no
   pre-selected "accept", no wall in front of the page.

   The choice lives in localStorage as mise:consent-v1. Anything optional added
   later must check hasOptionalConsent() first. */

const KEY = "mise:consent-v1";
const OPEN_EVENT = "mise:cookie-settings";

export function hasOptionalConsent() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}").optional === true; } catch { return false; }
}

export function CookieSettingsButton({ style }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer", ...style }}>
      Cookie settings
    </button>
  );
}

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const firstBtn = useRef(null);

  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage blocked: show the banner, it just won't remember */ }
    // The native iOS app has no cookies beyond the session and no web tracking surface; the banner is for the website.
    const native = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
    if (!saved && !native) setOpen(true);
    // Opened from "Cookie settings": move focus to it. On first visit it waits
    // at the bottom instead of stealing focus from the page.
    const reopen = () => { setOpen(true); setTimeout(() => firstBtn.current?.focus({ preventScroll: true }), 0); };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  function choose(optional) {
    try { localStorage.setItem(KEY, JSON.stringify({ optional, at: new Date().toISOString(), v: 1 })); } catch {}
    setOpen(false);
  }

  if (!open) return null;
  const btn = {
    flex: "1 1 0", minHeight: 44, borderRadius: 12, border: "2px solid #221A15", background: "#FFFFFF",
    color: "#221A15", font: "800 .95rem 'Nunito', system-ui, sans-serif", cursor: "pointer", padding: ".55rem .8rem",
  };
  return (
    <section role="region" aria-label="Cookie choices"
      onKeyDown={(e) => { if (e.key === "Escape") choose(false); }}
      style={{
        position: "fixed", zIndex: 2147483000, left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom))",
        maxWidth: 520, margin: "0 auto", background: "#FFFDF9", color: "#221A15", borderRadius: 18,
        border: "2px solid #221A15", boxShadow: "0 18px 40px rgba(34,26,21,.22)", padding: "1rem 1.1rem",
        fontFamily: "'Nunito', system-ui, sans-serif", fontSize: ".93rem", lineHeight: 1.5,
      }}>
      <p style={{ margin: "0 0 .2rem", fontWeight: 900, fontSize: "1rem" }}>Cookies</p>
      <p style={{ margin: "0 0 .8rem", fontWeight: 600, color: "#3B302A" }}>
        Mise uses one cookie to keep you signed in and remembers this choice on your device. No ads, no analytics,
        no tracking. We don&apos;t use any optional cookies right now; if that ever changes, only your choice here
        will allow them. <a href="/cookies" style={{ color: "#9A3B1B", fontWeight: 800 }}>Cookie Policy</a>
      </p>
      <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
        <button ref={firstBtn} type="button" style={btn} onClick={() => choose(false)}>Essential only</button>
        <button type="button" style={btn} onClick={() => choose(true)}>Allow optional</button>
      </div>
    </section>
  );
}
