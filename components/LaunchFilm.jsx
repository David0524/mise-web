"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* The launch film, full-screen, the first time someone opens the site. It is
   the pitch now (the app's old three-screen intro used to carry it), so it
   plays once on its own and then gets out of the way: when it ends, on Skip, or
   on Escape, it fades out and is remembered on this device. A small "Watch the
   film" link on the landing page brings it back on demand.

   - Muted autoplay is the only autoplay browsers allow, so it starts silent with
     a Sound button; the score is part of it, so the button is prominent.
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

export default function LaunchFilm({ replayLabel = "Watch the film" }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const video = useRef(null);
  const skipBtn = useRef(null);
  const opener = useRef(null);

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
      (opener.current || document.getElementById("main"))?.focus?.();
    }, 350);
  }, []);

  // Start playback once open: muted autoplay unless reduced motion; fall back to the paused poster.
  useEffect(() => {
    if (!open || closing) return;
    const v = video.current;
    if (!v) return;
    skipBtn.current?.focus();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setPaused(true); return; }
    v.muted = true; setMuted(true);
    const p = v.play();
    if (p && p.catch) p.then(() => setPaused(false)).catch(() => setPaused(true));
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
    const p = v.play(); setPaused(false);
    if (p && p.catch) p.catch(() => setPaused(true));
  };
  const toggleSound = () => {
    const v = video.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted);
    if (v.paused) play();
  };
  const replay = (e) => {
    opener.current = e.currentTarget;
    const v = video.current; if (v) v.currentTime = 0;
    setOpen(true);
  };

  return (
    <>
      <button type="button" className="lf-replay" onClick={replay}>
        <span aria-hidden="true" className="lf-replay__tri" />{replayLabel}
      </button>

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
            muted
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

      <style>{`
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
        .lf__btn:focus-visible,.lf__play:focus-visible,.lf-replay:focus-visible{outline:3px solid #EE9265;outline-offset:3px}
        .lf__play{position:absolute;width:88px;height:88px;border-radius:50%;border:0;background:#B44722;cursor:pointer;
          display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.35)}
        .lf__playtri{width:0;height:0;margin-left:6px;border-left:26px solid #fff;border-top:16px solid transparent;border-bottom:16px solid transparent}
        .lf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
        .lf-replay{display:inline-flex;align-items:center;gap:.5rem;margin:1.1rem auto 0;font:600 .95rem/1 'Nunito',system-ui,sans-serif;
          color:#B44722;background:none;border:0;padding:.6rem .4rem;cursor:pointer;min-height:44px}
        .lf-replay__tri{width:0;height:0;border-left:9px solid currentColor;border-top:6px solid transparent;border-bottom:6px solid transparent}
        @media (prefers-reduced-motion: reduce){.lf,.lf--out{animation:none}}
      `}</style>
    </>
  );
}
