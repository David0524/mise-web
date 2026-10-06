"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";
import MiseHello from "@/components/MiseHello";

/* The paywall. Everyone lands here after making an account, and anyone whose
   subscription has lapsed is sent back here by /app.

   Honest by construction: the price you'll pay after the first month, when
   that starts, and how to cancel are all on screen before the button, in
   type the same size as the offer. Two plans, neither pre-selected as a trick
   (monthly is the default because it's the smaller commitment). */

const PLANS = [
  { id: "monthly", label: "Monthly", price: "$12", per: "/month", sub: "Billed monthly" },
  { id: "yearly", label: "Yearly", price: "$120", per: "/year", sub: "$10 a month, billed yearly", badge: "2 months free" },
];

const PERKS = [
  ["A week of dinners, planned around you", "Your nights, your people, your kitchen. Never a generic meal plan."],
  ["One shopping list that gets used up", "Ingredients shared across the week, so the dill doesn't die in the drawer."],
  ["Change anything by asking", "Swap an ingredient, make it milder, lose the buns. The recipe and the list follow."],
  ["Cook mode at the stove", "Big steps, running timers, and a voice that reads them out."],
];

function Paywall() {
  const params = useSearchParams();
  const [plan, setPlan] = useState("monthly");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");

  useEffect(() => {
    fetch("/api/billing/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ signedIn: false, introEligible: true }));
  }, []);

  const intro = status ? status.introEligible !== false : true;
  const chosen = PLANS.find((p) => p.id === plan);
  const renewDate = new Date(Date.now() + 30 * 864e5).toLocaleDateString(undefined, { month: "long", day: "numeric" });

  async function subscribe() {
    if (status && !status.signedIn) { window.location.href = "/start"; return; }
    setBusy("pay"); setErr("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.href = "/login?next=/pricing"; return; }
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (e) { setErr(e.message); setBusy(""); }
  }

  async function redeem(e) {
    e.preventDefault();
    setBusy("code"); setCodeMsg("");
    try {
      const res = await fetch("/api/billing/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.href = "/login?next=/pricing"; return; }
      if (!res.ok) throw new Error(data.error || "That code didn't work.");
      window.location.href = "/app";
    } catch (e2) { setCodeMsg(e2.message); setBusy(""); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column", justifyContent: "flex-start", paddingTop: "2.2rem" }}>
      <FilterDefs />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pw" style={{ ...S.card, maxWidth: 460 }}>
        <div className="pw__hero">
          <MiseHello size={92} />
          {params.get("checkout") === "cancelled" && (
            <p style={{ ...S.notice, margin: "0 0 .8rem" }}>No charge was made. Pick up where you left off whenever you like.</p>
          )}
          {status?.active ? (
            <>
              <h1 className="pw__h">You&apos;re all set.</h1>
              <p className="pw__sub">Your kitchen is open.</p>
              <a href="/app" className="pw__cta" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>Go to my kitchen</a>
            </>
          ) : (
            <>
              <h1 className="pw__h">{intro ? <>Your first month is <span className="pw__hl">$1</span>.</> : "Keep cooking with Mise."}</h1>
              <p className="pw__sub">
                {intro ? "Then $12 a month or $120 a year. Cancel any time, right in the app." : "$12 a month or $120 a year. Cancel any time, right in the app."}
              </p>
            </>
          )}
        </div>

        {!status?.active && (
          <>
            <div className="pw__plans" role="radiogroup" aria-label="Choose a plan">
              {PLANS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={plan === p.id}
                  className={`pw__plan${plan === p.id ? " pw__plan--on" : ""}`} onClick={() => setPlan(p.id)}>
                  {p.badge && <span className="pw__badge">{p.badge}</span>}
                  <span className="pw__radio" aria-hidden="true" />
                  <span className="pw__pl">{p.label}</span>
                  <span className="pw__pp">{p.price}<span className="pw__per">{p.per}</span></span>
                  <span className="pw__ps">{p.sub}</span>
                </button>
              ))}
            </div>

            <div className="pw__today" aria-live="polite">
              {intro ? (
                <>
                  <div className="pw__row"><span>Due today</span><strong>$1.00</strong></div>
                  <div className="pw__row pw__row--muted"><span>From {renewDate}</span><span>{chosen.price}{chosen.per}</span></div>
                </>
              ) : (
                <div className="pw__row"><span>Due today</span><strong>{chosen.price}.00</strong></div>
              )}
            </div>

            {err && <p style={{ ...S.error, marginTop: 12 }} role="alert">{err}</p>}
            <button className="pw__cta" onClick={subscribe} disabled={!!busy}>
              {busy === "pay" ? "Opening checkout…" : status && !status.signedIn ? "Get started" : intro ? "Start my $1 month" : `Subscribe for ${chosen.price}${chosen.per}`}
            </button>

            <p className="pw__fine">
              {intro
                ? `$1 today for 30 days. Then ${chosen.price}${chosen.per}, renewing automatically until you cancel. `
                : `Renews automatically at ${chosen.price}${chosen.per} until you cancel. `}
              Cancel any time in My Kitchen; you keep access until the end of the period you paid for. Any tax is shown at checkout before you pay.{" "}
              <a href="/terms">Terms</a> · <a href="/refunds">Refunds</a>
            </p>

            <ul className="pw__perks">
              {PERKS.map(([h, p]) => (
                <li key={h}>
                  <span className="pw__tick" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span><strong>{h}</strong><span className="pw__pd">{p}</span></span>
                </li>
              ))}
            </ul>

            <div className="pw__code">
              {!codeOpen ? (
                <button type="button" className="pw__link" onClick={() => setCodeOpen(true)}>Have a code?</button>
              ) : (
                <form onSubmit={redeem} className="pw__codeform">
                  <label htmlFor="code" className="pw__codelab">Access code</label>
                  <div className="pw__coderow">
                    <input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off"
                      autoCapitalize="characters" spellCheck="false" className="pw__codein" autoFocus />
                    <button className="pw__apply" disabled={!code.trim() || busy === "code"}>{busy === "code" ? "…" : "Apply"}</button>
                  </div>
                  {codeMsg && <p className="pw__codeerr" role="alert">{codeMsg}</p>}
                </form>
              )}
            </div>
          </>
        )}

        {status?.signedIn ? (
          <p className="pw__acct">Wrong account? <button type="button" className="pw__link" onClick={signOut}>Sign out</button></p>
        ) : status ? (
          <p className="pw__acct">Already a member? <a href="/login?next=/pricing">Sign in</a></p>
        ) : null}
      </div>
      <SiteFooter />
    </main>
  );
}

export default function PricingPage() {
  return <Suspense fallback={null}><Paywall /></Suspense>;
}

const CSS = `
.pw{font-family:'Nunito',system-ui,sans-serif;color:#221A15;padding:1.8rem 1.4rem 1.4rem}
.pw__hero{text-align:center}
.pw__h{font-weight:900;font-size:1.95rem;letter-spacing:-.03em;line-height:1.1;margin:.5rem 0 .4rem}
.pw__hl{color:#B44722}
.pw__sub{font-weight:700;color:#51453D;margin:0 0 1.3rem;line-height:1.45}
.pw__plans{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
.pw__plan{position:relative;text-align:left;font:inherit;color:inherit;cursor:pointer;border-radius:20px;
  padding:1rem .9rem .9rem;background:rgba(255,255,255,.7);border:2px solid rgba(34,26,21,.14);
  display:flex;flex-direction:column;gap:.15rem;transition:border-color .15s,box-shadow .15s,transform .12s}
.pw__plan:active{transform:scale(.985)}
.pw__plan--on{border-color:#B44722;background:#fff;box-shadow:0 10px 26px -14px rgba(180,71,34,.55)}
.pw__radio{position:absolute;top:.9rem;right:.85rem;width:18px;height:18px;border-radius:50%;border:2px solid #8A7D75;box-sizing:border-box}
.pw__plan--on .pw__radio{border:6px solid #B44722}
.pw__badge{position:absolute;top:-.62rem;left:.8rem;background:#573C56;color:#fff;font-size:.7rem;font-weight:900;
  letter-spacing:.02em;padding:.18rem .55rem;border-radius:99px}
.pw__pl{font-weight:800;font-size:.9rem;color:#573C56}
.pw__pp{font-weight:900;font-size:1.6rem;letter-spacing:-.03em;line-height:1.1}
.pw__per{font-size:.85rem;font-weight:800;color:#72645C;letter-spacing:0}
.pw__ps{font-size:.8rem;font-weight:700;color:#72645C}
.pw__today{margin:1rem 0 0;padding:.8rem .95rem;border-radius:16px;background:rgba(244,235,233,.85)}
.pw__row{display:flex;justify-content:space-between;font-weight:800;font-size:.97rem}
.pw__row--muted{font-weight:700;color:#51453D;font-size:.9rem;margin-top:.25rem}
.pw__cta{width:100%;margin-top:1rem;padding:.95rem;border-radius:18px;border:0;background:#B44722;color:#fff;
  font:800 1.06rem 'Nunito',system-ui,sans-serif;cursor:pointer;box-sizing:border-box;
  box-shadow:0 2px 0 #813318,inset 0 1px 0 rgba(255,255,255,.25),0 12px 28px -12px rgba(180,71,34,.6)}
.pw__cta:disabled{opacity:.6;cursor:wait}
.pw__fine{font-size:.8rem;font-weight:600;color:#51453D;line-height:1.5;margin:.8rem 0 0;text-align:center}
.pw__fine a,.pw__acct a{color:#9A3B1B;font-weight:800}
.pw__perks{list-style:none;margin:1.4rem 0 0;padding:1.1rem 0 0;border-top:1px solid rgba(34,26,21,.1);display:flex;flex-direction:column;gap:.85rem}
.pw__perks li{display:flex;gap:.7rem;align-items:flex-start;font-size:.95rem;line-height:1.4}
.pw__tick{flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:rgba(180,71,34,.12);color:#B44722;display:grid;place-items:center;margin-top:1px}
.pw__pd{display:block;font-weight:600;color:#51453D;font-size:.88rem}
.pw__code{margin-top:1.2rem;text-align:center}
.pw__link{background:none;border:0;padding:.3rem;font:800 .92rem 'Nunito',system-ui,sans-serif;color:#9A3B1B;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.pw__codeform{text-align:left}
.pw__codelab{display:block;font-weight:800;font-size:.85rem;color:#573C56;margin-bottom:.35rem}
.pw__coderow{display:flex;gap:.5rem}
.pw__codein{flex:1;min-width:0;min-height:46px;border-radius:14px;border:1px solid #8A7D75;padding:0 .8rem;
  font:800 1rem 'Nunito',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;background:rgba(255,255,255,.85);color:#221A15}
.pw__apply{min-height:46px;padding:0 1.1rem;border-radius:14px;border:2px solid #221A15;background:#fff;font:800 .95rem 'Nunito',system-ui,sans-serif;cursor:pointer;color:#221A15}
.pw__apply:disabled{opacity:.5;cursor:default}
.pw__codeerr{color:#7A2E1B;font-weight:700;font-size:.88rem;margin:.4rem 0 0}
.pw__acct{text-align:center;font-weight:700;font-size:.88rem;color:#51453D;margin:1rem 0 0}
.pw button:focus-visible,.pw a:focus-visible,.pw input:focus-visible{outline:3px solid #B44722;outline-offset:2px}
@media (max-width:360px){.pw__plans{grid-template-columns:1fr}}
`;
