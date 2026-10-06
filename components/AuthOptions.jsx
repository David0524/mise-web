"use client";
import { useEffect, useState } from "react";

/* Continue with Apple / Google / phone. Shared by the sign-in page and the
   last step of onboarding.

   `consent` is true when the person has already ticked "18 or older" and the
   Terms on this screen; a brand-new account is then created straight away.
   Without it, a new account goes via /auth/consent first. `disabled` greys
   the buttons out until those boxes are ticked. `from` is the page to come
   back to with an error. */

const AppleLogo = () => (
  <svg viewBox="0 0 17 20" width="17" height="20" aria-hidden="true"><path fill="currentColor" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>
);
const GoogleLogo = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/>
    <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8z"/>
    <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.4l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"/>
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
);

/* Which methods this deployment has set up (see /api/auth/providers). Only
   those get a button: a button that can only fail is worse than none. */
export function useProviders() {
  const [p, setP] = useState(null);
  useEffect(() => {
    fetch("/api/auth/providers").then((r) => r.json()).then(setP).catch(() => setP({}));
  }, []);
  return p;
}

export default function AuthOptions({ consent = false, disabled = false, from = "/login", next = "", onNeedConsent, divider = "or with email" }) {
  const available = useProviders();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const q = new URLSearchParams({ from, ...(consent ? { consent: "1" } : {}), ...(next ? { next } : {}) }).toString();
  const finish = () => { window.location.href = `/auth/finish${next ? `?next=${encodeURIComponent(next)}` : ""}`; };

  async function post(url, body) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return data;
  }

  async function sendCode(e) {
    e?.preventDefault();
    setBusy(true); setErr("");
    try { const d = await post("/api/auth/phone/start", { phone }); setSent(d.phone); setCode(""); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }
  async function verify(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const d = await post("/api/auth/phone/verify", { phone: sent, code, ageConfirmed: consent, termsAccepted: consent });
      if (d.needsConsent) { if (onNeedConsent) onNeedConsent(); else window.location.href = "/auth/consent"; return; }
      finish();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  const go = (provider) => (e) => { if (disabled) { e.preventDefault(); return; } };

  if (!available || !(available.apple || available.google || available.phone)) return null;

  return (
    <div className="ao">
      {available.apple && <a href={disabled ? undefined : `/api/auth/apple?${q}`} onClick={go("apple")} aria-disabled={disabled || undefined}
        className="ao__b ao__b--apple" role="button"><AppleLogo /> Continue with Apple</a>}
      {available.google && <a href={disabled ? undefined : `/api/auth/google?${q}`} onClick={go("google")} aria-disabled={disabled || undefined}
        className="ao__b ao__b--google" role="button"><GoogleLogo /> Continue with Google</a>}
      {!available.phone ? null : !phoneOpen ? (
        <button type="button" className="ao__b ao__b--phone" disabled={disabled} onClick={() => setPhoneOpen(true)}>
          <PhoneIcon /> Continue with phone
        </button>
      ) : !sent ? (
        <form className="ao__phone" onSubmit={sendCode}>
          <label htmlFor="ao-phone">Mobile number</label>
          <div className="ao__row">
            <input id="ao-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 555 123 4567"
              value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
            <button className="ao__go" disabled={busy || disabled || !phone.trim()}>{busy ? "Sending…" : "Text me a code"}</button>
          </div>
          <p className="ao__fine">We&apos;ll text a 6-digit code. Message and data rates may apply.</p>
        </form>
      ) : (
        <form className="ao__phone" onSubmit={verify}>
          <label htmlFor="ao-code">Code sent to {sent}</label>
          <div className="ao__row">
            <input id="ao-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8}
              value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
            <button className="ao__go" disabled={busy || code.length < 4}>{busy ? "Checking…" : "Continue"}</button>
          </div>
          <p className="ao__fine">
            <button type="button" className="ao__link" onClick={sendCode} disabled={busy}>Send a new code</button>
            {" · "}
            <button type="button" className="ao__link" onClick={() => { setSent(""); setErr(""); }}>Change number</button>
          </p>
        </form>
      )}
      {err && <p className="ao__err" role="alert">{err}</p>}
      {divider && <div className="ao__or"><span />{divider}<span /></div>}
      <style dangerouslySetInnerHTML={{ __html: AO_CSS }} />
    </div>
  );
}

const AO_CSS = `
.ao{display:flex;flex-direction:column;gap:.6rem;font-family:'Nunito',system-ui,sans-serif}
.ao__b{display:flex;align-items:center;justify-content:center;gap:.6rem;min-height:50px;border-radius:16px;
  font:800 1rem 'Nunito',system-ui,sans-serif;text-decoration:none;cursor:pointer;box-sizing:border-box;width:100%;
  transition:transform .12s, filter .15s}
.ao__b:active{transform:scale(.985)}
.ao__b--apple{background:#000;color:#fff;border:0}
.ao__b--google{background:#fff;color:#1F1F1F;border:1px solid #747775}
.ao__b--phone{background:rgba(255,255,255,.75);color:#221A15;border:1.5px solid #221A15}
.ao__b[aria-disabled="true"],.ao__b:disabled{opacity:.4;cursor:not-allowed;transform:none}
.ao__phone{background:rgba(255,255,255,.7);border:1px solid rgba(34,26,21,.14);border-radius:16px;padding:.8rem}
.ao__phone label{display:block;font-weight:800;font-size:.85rem;color:#573C56;margin-bottom:.4rem}
.ao__row{display:flex;gap:.5rem}
.ao__row input{flex:1;min-width:0;min-height:46px;border-radius:12px;border:1px solid #8A7D75;padding:0 .75rem;
  font:700 1rem 'Nunito',system-ui,sans-serif;color:#221A15;background:#fff}
.ao__go{min-height:46px;padding:0 .9rem;border-radius:12px;border:0;background:#B44722;color:#fff;font:800 .92rem 'Nunito',system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.ao__go:disabled{opacity:.5;cursor:default}
.ao__fine{font-size:.8rem;font-weight:600;color:#51453D;margin:.45rem 0 0}
.ao__link{background:none;border:0;padding:0;font:800 .8rem 'Nunito',system-ui,sans-serif;color:#9A3B1B;cursor:pointer;text-decoration:underline}
.ao__or{display:flex;align-items:center;gap:.7rem;margin:.7rem 0 0;font-weight:700;font-size:.85rem;color:#72645C}
.ao__or span{flex:1;height:1px;background:rgba(34,26,21,.15)}
.ao__err{color:#7A2E1B;font-weight:700;font-size:.9rem;margin:.2rem 0 0;background:rgba(238,146,101,.2);border:1px solid #EE9265;border-radius:12px;padding:.55rem .7rem}
.ao a:focus-visible,.ao button:focus-visible,.ao input:focus-visible{outline:3px solid #B44722;outline-offset:2px}
`;
