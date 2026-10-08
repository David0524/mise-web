"use client";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const video = useRef(null);
  const skipBtn = useRef(null);

  useEffect(() => {
    if (seen()) return;
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

  return (
    <>
      {open && (
        <div className={`lf${closing ? " lf--out" : ""}`} role="dialog" aria-modal="true" aria-label="Mise launch film" aria-describedby="lf-desc">
          <p id="lf-desc" className="lf-sr">
            A 18-second film. On screen: mess. Every good recipe starts the same way. A counter full of maybe.
            Prep. Place. Play. Everything right where your hands expect it. Mise.
          </p>
          <video
            ref={video}
            className="lf__video"
            src={SRC}
            poster={POSTER}
            playsInline
            preload="auto"
            onEnded={close}
            onPause={() => setPaused(true)}
            onPlay={() => setPaused(false)}
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
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: LF_CSS }} />
    </>
  );
}

// Injected as raw HTML: as a text child, React escapes the quotes on the
// server and the page fails to hydrate.
const LF_CSS = `
        .lf{position:fixed;inset:0;z-index:1000;background:#141414;display:flex;align-items:center;justify-content:center;
          animation:lf-in .35s ease-out both}
        .lf--out{animation:lf-out .35s ease-in both}
        @keyframes lf-in{from{opacity:0}to{opacity:1}}
        @keyframes lf-out{from{opacity:1}to{opacity:0}}
        .lf__video{width:100%;height:100%;object-fit:contain;background:#141414}
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
