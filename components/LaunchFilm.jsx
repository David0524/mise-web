"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* The launch film, full-screen, the first time someone opens the site. It is
   the pitch now (the app's old three-screen intro used to carry it), so it
   plays once on its own and then gets out of the way: when it ends, on Skip, or
   on Escape, it fades out and is remembered on this device. It only ever plays
   that first time; there is no replay.

   - It tries to start with sound. Browsers often refuse unmuted autoplay before
     the visitor has touched the page, so if that is refused it falls back to
     muted autoplay with a prominent "Sound on" button.
   - Reduced motion: never autoplays. The first visit still offers it, paused on
     its poster with a Play button.
   - Autoplay blocked (iOS Low Power Mode, data saver): same paused state.
   - Decided after mount, like HomeScreenTip, so server and client render the
     same nothing and crawlers see the landing page, not a video. */

const KEY = "mise:film-seen";
const SRC = "/video/mise-launch-vertical.mp4";
const POSTER = "/video/mise-launch-poster.jpg";

function seen() {
  try { return window.localStorage.getItem(KEY) === "1"; } catch (_) { return false; }
}
function remember() {
  try { window.localStorage.setItem(KEY, "1"); } catch (_) { /* private mode: it plays again next time */ }
}

export default function LaunchFilm() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [wide, setWide] = useState(false);
  const video = useRef(null);
  const back = useRef(null);
  const skipBtn = useRef(null);

  useEffect(() => {
    if (seen()) return;
    // Phones (portrait) get the film full-bleed. On a landscape screen covering
    // would crop away the on-screen words, so the whole film sits in the middle
    // and a blurred copy of it fills the rest of the screen.
    setWide(window.innerWidth / window.innerHeight > 0.8);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    remember();
    setClosing(true);
    setTimeout(() => {
      setOpen(false); setClosing(false);
      try { video.current?.pause(); } catch (_) {}
      document.getElementById("main")?.focus?.();
    }, 350);
  }, []);

  // Start playback once open: with sound if the browser allows it, else muted,
  // else the paused poster. Reduced motion never autoplays.
  useEffect(() => {
    if (!open || closing) return;
    const v = video.current;
    if (!v) return;
    skipBtn.current?.focus();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setPaused(true); return; }
    let cancelled = false;
    v.muted = false; setMuted(false);
    const p = v.play();
    if (p && p.catch) p.then(() => setPaused(false)).catch(() => {
      if (cancelled) return;
      v.muted = true; setMuted(true);
      const q = v.play();
      if (q && q.catch) q.then(() => setPaused(false)).catch(() => setPaused(true));
    });
    return () => { cancelled = true; };
  }, [open, closing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, close]);

  const play = () => {
    const v = video.current; if (!v) return;
    v.muted = false; setMuted(false); // a tap counts as a gesture, so sound is allowed now
    const p = v.play(); setPaused(false);
    if (p && p.catch) p.catch(() => setPaused(true));
  };
  const toggleSound = () => {
    const v = video.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted);
    if (v.paused) play();
  };

  // The backdrop copy follows the film: same play/pause, nudged back if it drifts.
  const follow = (fn) => { const b = back.current; if (b) try { fn(b); } catch (_) {} };
  const sync = () => follow((b) => {
    const t = video.current?.currentTime || 0;
    if (Math.abs(b.currentTime - t) > 0.25) b.currentTime = t;
  });

  return (
    <>
      {open && createPortal(
        <div className={`lf${closing ? " lf--out" : ""}`} role="dialog" aria-modal="true" aria-label="Mise launch film" aria-describedby="lf-desc">
          <p id="lf-desc" className="lf-sr">
            A 18-second film. On screen: mess. Every good recipe starts the same way. A counter full of maybe.
            Prep. Place. Play. Everything right where your hands expect it. Mise.
          </p>
          {wide && (
            <video ref={back} className="lf__back" src={SRC} muted playsInline preload="auto" aria-hidden="true" tabIndex={-1} />
          )}
          <video
            ref={video}
            className={`lf__video${wide ? " lf__video--wide" : ""}`}
            src={SRC}
            poster={POSTER}
            playsInline
            preload="auto"
            onEnded={close}
            onPause={() => { setPaused(true); follow((b) => b.pause()); }}
            onPlay={() => { setPaused(false); sync(); follow((b) => b.play()?.catch?.(() => {})); }}
            onTimeUpdate={sync}
          />
          {paused && (
            <button type="button" className="lf__play" onClick={play} aria-label="Play the film">
              <span aria-hidden="true" className="lf__playtri" />
            </button>
          )}
          <div className="lf__bar">
            <button type="button" className="lf__btn" onClick={toggleSound} aria-pressed={!muted}>
              {muted ? "Sound on" : "Sound off"}
            </button>
            <button type="button" className="lf__btn lf__btn--skip" onClick={close} ref={skipBtn}>
              Skip
            </button>
          </div>
        </div>,
        document.body
      )}

      <style dangerouslySetInnerHTML={{ __html: LF_CSS }} />
    </>
  );
}

// Injected as raw HTML: as a text child, React escapes the quotes on the
// server and the page fails to hydrate.
const LF_CSS = `
        .lf{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;z-index:2147483600;background:#141414;display:flex;align-items:center;justify-content:center;
          animation:lf-in .35s ease-out both}
        .lf--out{animation:lf-out .35s ease-in both}
        @keyframes lf-in{from{opacity:0}to{opacity:1}}
        @keyframes lf-out{from{opacity:1}to{opacity:0}}
        .lf__video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#141414}
        .lf__video--wide{object-fit:contain;background:transparent}
        .lf__back{position:absolute;inset:-6%;width:112%;height:112%;object-fit:cover;filter:blur(40px) brightness(.75);pointer-events:none}
        .lf__bar{position:absolute;left:0;right:0;bottom:max(16px,env(safe-area-inset-bottom));display:flex;justify-content:space-between;
          padding:0 16px;pointer-events:none}
        .lf__btn{pointer-events:auto;font:600 15px/1 'Nunito',system-ui,sans-serif;color:#F2F0EC;background:rgba(20,20,20,.55);
          border:1px solid rgba(242,240,236,.35);border-radius:999px;padding:12px 18px;min-height:44px;cursor:pointer;
          backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
        .lf__btn:focus-visible,.lf__play:focus-visible{outline:3px solid #EE9265;outline-offset:3px}
        .lf__play{position:absolute;width:88px;height:88px;border-radius:50%;border:0;background:#B44722;cursor:pointer;
          display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.35)}
        .lf__playtri{width:0;height:0;margin-left:6px;border-left:26px solid #fff;border-top:16px solid transparent;border-bottom:16px solid transparent}
        .lf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
        @media (prefers-reduced-motion: reduce){.lf,.lf--out{animation:none}}
`;
