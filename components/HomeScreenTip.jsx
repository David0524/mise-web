"use client";
import { useEffect, useState } from "react";

/* "Add Mise to your Home Screen" — a small, one-time card at the top of the
   week. On iPhone there's no install prompt at all: Safari hides it two taps
   deep in the Share sheet, so most people never find it unless told. Saved to
   the Home Screen, Mise opens full-screen like an app and stays signed in.

   Shown only where it applies:
   - iPhone Safari in a normal tab (not already launched from the Home Screen,
     not the Capacitor iOS app, not an in-app browser or Chrome/Firefox for iOS,
     whose share menus differ);
   - Android, only if Chrome actually offers an install (beforeinstallprompt),
     in which case the button triggers the real prompt;
   - never on desktop.
   Kept in its own file with its own class names so it can't collide with the
   app's stylesheet. */

const KEY = "mise:a2hs-dismissed";

function dismissed() {
  try { return window.localStorage.getItem(KEY) === "1"; } catch (_) { return false; }
}
function remember() {
  try { window.localStorage.setItem(KEY, "1"); } catch (_) { /* private mode: it just comes back next time */ }
}

function isInstalled() {
  return navigator.standalone === true
    || !!window.matchMedia?.("(display-mode: standalone)").matches
    || !!window.Capacitor?.isNativePlatform?.();
}

function isIphoneSafari() {
  const ua = navigator.userAgent || "";
  if (!/iPhone|iPod/.test(ua)) return false;
  // Every iOS browser is WebKit and says "Safari"; these are the ones that aren't Safari.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|Snapchat/.test(ua)) return false;
  return /Safari\//.test(ua);
}

/* The iOS share glyph: a box with an arrow out of the top — what they'll be
   looking for in Safari's toolbar. */
function ShareGlyph() {
  return (
    <svg className="a2hs__glyph" width="15" height="19" viewBox="0 0 15 19" aria-hidden="true">
      <path d="M7.5 1v11M3.8 4.6 7.5 1l3.7 3.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 7.5H2.6A1.1 1.1 0 0 0 1.5 8.6v8.3A1.1 1.1 0 0 0 2.6 18h9.8a1.1 1.1 0 0 0 1.1-1.1V8.6a1.1 1.1 0 0 0-1.1-1.1H10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function HomeScreenTip() {
  // Decided after mount: the server can't know the device, and rendering
  // nothing first keeps hydration identical on every platform.
  const [mode, setMode] = useState(null); // null | "ios" | "android"
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    if (dismissed() || isInstalled()) return;
    if (isIphoneSafari()) { setMode("ios"); return; }
    if (!/Android/.test(navigator.userAgent || "")) return;
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); setMode("android"); };
    const onInstalled = () => { remember(); setMode(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode) return null;

  const close = () => { remember(); setMode(null); };
  const install = async () => {
    try { await prompt?.prompt(); await prompt?.userChoice; } catch (_) {}
    close();
  };

  return (
    <aside className="a2hs no-print" aria-label="Add Mise to your Home Screen">
      <style dangerouslySetInnerHTML={{ __html: A2HS_CSS }} />
      <img className="a2hs__icon" src="/apple-touch-icon.png" alt="" width="40" height="40" />
      <div className="a2hs__t">
        <strong>Add Mise to your Home Screen</strong>
        {mode === "ios" ? (
          <span>Tap <ShareGlyph /> Share, then <b>Add to Home Screen</b>.</span>
        ) : (
          <span>It opens like an app, right from your Home Screen.</span>
        )}
      </div>
      {mode === "android" && (
        <button type="button" className="a2hs__add" onClick={install}>Add</button>
      )}
      <button type="button" className="a2hs__x" onClick={close} aria-label="Dismiss">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  );
}

/* Uses the app's palette variables (defined on .app) with literal fallbacks. */
const A2HS_CSS = `
.a2hs{display:flex;align-items:center;gap:.75rem;margin:0 0 .85rem;
  padding:.7rem .6rem .7rem .75rem;border-radius:20px;
  background:var(--surface,#fff);border:1px solid var(--rule,rgba(34,26,21,.11));
  box-shadow:0 6px 18px rgba(34,26,21,.07);color:var(--ink,#221A15);
  font-family:'Nunito',sans-serif;line-height:1.35}
.a2hs__icon{width:40px;height:40px;border-radius:10px;flex-shrink:0;
  box-shadow:0 1px 3px rgba(34,26,21,.18)}
.a2hs__t{flex:1;min-width:0;display:flex;flex-direction:column;gap:.1rem;font-size:.9rem}
.a2hs__t strong{font-weight:800;font-size:.95rem}
.a2hs__t span{color:var(--ink-2,#51453D)}
.a2hs__t b{font-weight:800;color:var(--ink,#221A15)}
.a2hs__glyph{display:inline-block;vertical-align:-3px;margin:0 .1rem;color:var(--brick,#B44722)}
.a2hs__add{flex-shrink:0;border:0;border-radius:999px;padding:.45rem .95rem;
  background:var(--brick,#B44722);color:#fff;font:800 .88rem 'Nunito',sans-serif;cursor:pointer}
.a2hs__x{flex-shrink:0;align-self:flex-start;width:32px;height:32px;margin:-.25rem -.1rem 0 0;
  display:flex;align-items:center;justify-content:center;border:0;border-radius:999px;
  background:none;color:var(--muted,#72645C);cursor:pointer}
.a2hs__x:hover{background:var(--sunk,#F4EBE9)}
.a2hs__x:focus-visible,.a2hs__add:focus-visible{outline:2px solid var(--brick,#B44722);outline-offset:2px}
`;
