"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FilterDefs, DAYLIGHT } from "@/lib/authStyles";
import MiseHello from "@/components/MiseHello";

/* The paywall: a sheet that slides up over a blurred preview of the person's
   own week, built from the setup they just finished.

   What it's built on (paywall research, Oct 2026):
   - Shown right after value, and personalised: contextual paywalls convert
     ~3x cold ones; personalised beat generic by 15%+. So the backdrop is
     THEIR kitchen and the headline uses their answers.
   - An outcome headline, not "Go premium".
   - Two plans, a clear winner, longest plan selected by default with its
     per-month price (default-to-annual moved annual share 37% -> 63%).
   - A "how your first month works" timeline with explicit cancellation,
     which correlates with more trial starts and fewer surprised customers.
   - One sticky CTA. Secondary links small, but present and readable.
   Everything that costs money is on screen before the button: no hidden
   renewal, no pre-ticked anything, no fake reviews or countdowns. */

const DAY = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PLANS = {
  yearly: { id: "yearly", label: "Yearly", price: "$120", per: "/year", eq: "$10/month", badge: "2 months free" },
  monthly: { id: "monthly", label: "Monthly", price: "$12", per: "/month", eq: "Billed monthly" },
};

function useKitchen() {
  const [k, setK] = useState(null);
  useEffect(() => {
    fetch("/api/storage?key=mise:profile-v3").then((r) => (r.ok ? r.json() : null)).then((j) => {
      try { setK(JSON.parse(j?.value || "{}").profile || {}); } catch { setK({}); }
    }).catch(() => setK({}));
  }, []);
  return k;
}

function pitch(k) {
  const nights = ORDER.filter((d) => (k?.nights || []).includes(d));
  const n = nights.length || 3;
  const people = Number(k?.people) || 2;
  const avoid = (k?.restrictions || []).slice(0, 2).join(" and ").toLowerCase();
  return {
    nights,
    line: `${n} ${avoid ? `${avoid} ` : ""}dinner${n === 1 ? "" : "s"} a week for ${people === 1 ? "you" : people}, planned around your kitchen.`,
  };
}

/* The blurred "your week, ready to go" behind the sheet. Decorative. */
function Backdrop({ k }) {
  const { nights } = pitch(k);
  const days = nights.length ? nights : ["Tue", "Thu", "Sat"];
  return (
    <div className="bd" aria-hidden="true">
      <div className="bd__hdr"><span className="bd__logo">Mise</span><span className="bd__av" /></div>
      <div className="bd__card">
        <p className="bd__k">This week</p>
        <p className="bd__h">Your {days.length} nights, planned</p>
        {days.map((d, i) => (
          <div key={d} className="bd__row">
            <span className="bd__day">{DAY[d]}</span>
            <span className="bd__dish" style={{ width: `${62 - i * 7}%` }} />
          </div>
        ))}
      </div>
      <div className="bd__card">
        <p className="bd__k">Shopping list</p>
        {[78, 64, 70, 52, 66].map((w, i) => (
          <div key={i} className="bd__item"><span className="bd__box" /><span className="bd__line" style={{ width: `${w}%` }} /></div>
        ))}
      </div>
    </div>
  );
}

function Paywall() {
  const params = useSearchParams();
  const kitchen = useKitchen();
  const [plan, setPlan] = useState("yearly");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const [up, setUp] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status").then((r) => r.json()).then((s) => {
      // Not set up yet: onboarding comes first.
      if (s.signedIn && !s.active && s.setupDone === false) { window.location.replace("/start"); return; }
      setStatus(s);
    }).catch(() => setStatus({ signedIn: true, introEligible: true, error: "network" }));
    const t = setTimeout(() => setUp(true), 60);
    return () => clearTimeout(t);
  }, []);

  const intro = status ? status.introEligible !== false : true;
  const p = PLANS[plan];
  const startDate = new Date(Date.now() + 30 * 864e5).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const { line } = pitch(kitchen || {});

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

  const active = status?.active;

  return (
    <div className="pwx" style={{ backgroundImage: DAYLIGHT }}>
      <FilterDefs />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Backdrop k={kitchen} />
      <div className="pwx__scrim" aria-hidden="true" />

      <main id="main" className={`sheet${up ? " sheet--up" : ""}`} role="dialog" aria-modal="true" aria-labelledby="pw-h">
        <span className="sheet__grab" aria-hidden="true" />
        <div className="sheet__body">
          <div className="sheet__top">
            <span className="sheet__mise"><MiseHello size={46} label="" /></span>
            <div>
              {params.get("checkout") === "cancelled" && <p className="sheet__note">No charge was made. Ready when you are.</p>}
              <h1 id="pw-h" className="sheet__h">
                {active ? "You're all set." : intro ? <>Your first month is <span className="hl">$1</span></> : "Pick up where you left off."}
              </h1>
              <p className="sheet__sub">{active ? "Your kitchen is open." : kitchen ? line : "Your week, planned around your kitchen."}</p>
            </div>
          </div>

          {!active && (
            <>
              <ul className="ben">
                <li><Ico d="M4 6h16M4 12h16M4 18h10" />Week planned</li>
                <li><Ico d="M5 7h14l-1.5 11h-11zM9 7a3 3 0 0 1 6 0" />One list</li>
                <li><Ico d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />Cook mode</li>
              </ul>

              <div className="plans" role="radiogroup" aria-label="Choose a plan">
                {Object.values(PLANS).map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={plan === o.id}
                    className={`plan${plan === o.id ? " plan--on" : ""}`} onClick={() => setPlan(o.id)}>
                    {o.badge && <span className="plan__badge">{o.badge}</span>}
                    <span className="plan__dot" aria-hidden="true" />
                    <span className="plan__l">{o.label}</span>
                    <span className="plan__p">{o.price}<small>{o.per}</small></span>
                    <span className="plan__eq">{o.eq}</span>
                  </button>
                ))}
              </div>

              {intro ? (
                <ol className="tl" aria-label="How your first month works">
                  <li className="tl__i tl__i--now"><span className="tl__dot" aria-hidden="true" /><strong>Today</strong><span>$1 for 30 days</span></li>
                  <li className="tl__i"><span className="tl__dot" aria-hidden="true" /><strong>Before {startDate}</strong><span>Cancel free in My Kitchen</span></li>
                  <li className="tl__i"><span className="tl__dot" aria-hidden="true" /><strong>{startDate}</strong><span>{p.price}{p.per} begins</span></li>
                </ol>
              ) : (
                <p className="renew">Renews at {p.price}{p.per} until you cancel. Cancel any time in My Kitchen.</p>
              )}
            </>
          )}
        </div>

        <div className="sheet__foot">
          {err && <p className="err" role="alert">{err}</p>}
          {active ? (
            <a href="/app" className="cta">Go to my kitchen</a>
          ) : (
            <button className="cta" onClick={subscribe} disabled={!!busy}>
              {busy === "pay" ? "Opening secure checkout…" : status && !status.signedIn ? "Get started" : intro ? "Start my $1 month" : `Subscribe · ${p.price}${p.per}`}
            </button>
          )}
          {!active && (
            <p className="fine">
              {intro ? `$1 today, then ${p.price}${p.per} from ${startDate}.` : `${p.price}${p.per}.`} Any tax is shown at checkout.{" "}
              <a href="/terms">Terms</a> · <a href="/refunds">Refunds</a> · <a href="/privacy">Privacy</a>
            </p>
          )}

          {!active && (codeOpen ? (
            <form onSubmit={redeem} className="code">
              <label htmlFor="code" className="sr">Access code</label>
              <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code"
                autoComplete="off" autoCapitalize="characters" spellCheck="false" autoFocus />
              <button disabled={!code.trim() || busy === "code"}>{busy === "code" ? "…" : "Apply"}</button>
              {codeMsg && <p className="code__err" role="alert">{codeMsg}</p>}
            </form>
          ) : null)}
          <p className="links">
            {!active && !codeOpen && <><button type="button" className="lnk" onClick={() => setCodeOpen(true)}>Have a code?</button><span aria-hidden="true"> · </span></>}
            {status?.signedIn
              ? <button type="button" className="lnk" onClick={signOut}>Sign out</button>
              : <a className="lnk" href="/login?next=/pricing">Sign in</a>}
          </p>
        </div>
      </main>
    </div>
  );
}

function Ico({ d }) {
  return (
    <span className="ben__i" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export default function PricingPage() {
  return <Suspense fallback={null}><Paywall /></Suspense>;
}

const CSS = `
.pwx{position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;background-color:#FAF5F4;font-family:'Nunito',system-ui,sans-serif;color:#221A15}
/* The person's week, behind glass. */
.bd{position:absolute;inset:0;padding:calc(1rem + env(safe-area-inset-top)) 1rem 0;max-width:520px;margin:0 auto;filter:blur(2.5px) saturate(1.05);transform:scale(1.02)}
.bd__hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
.bd__logo{font:italic 800 1.8rem 'Nunito',sans-serif}
.bd__av{width:44px;height:44px;border-radius:50%;background:#fff;border:1px solid rgba(34,26,21,.15)}
.bd__card{background:#fff;border-radius:26px;padding:1.1rem;margin-bottom:.9rem;box-shadow:0 14px 34px -18px rgba(34,26,21,.3)}
.bd__k{margin:0;font-size:.7rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#B44722}
.bd__h{margin:.2rem 0 .7rem;font-weight:900;font-size:1.3rem}
.bd__row{display:flex;align-items:center;gap:.8rem;padding:.65rem 0;border-top:1px solid rgba(34,26,21,.08)}
.bd__day{font-weight:800;width:5.5rem;font-size:.9rem}
.bd__dish{height:12px;border-radius:6px;background:linear-gradient(90deg,#EE9265,#B44722)}
.bd__item{display:flex;align-items:center;gap:.7rem;padding:.45rem 0}
.bd__box{width:18px;height:18px;border-radius:5px;border:2px solid #8A7D75}
.bd__line{height:10px;border-radius:5px;background:rgba(34,26,21,.18)}
.pwx__scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,22,30,0),rgba(24,22,30,.34))}

/* The sheet. */
.sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:520px;max-height:calc(100dvh - 2.5rem - env(safe-area-inset-top));
  display:flex;flex-direction:column;background:#FFFFFF;border-radius:30px 30px 0 0;
  box-shadow:0 -18px 50px -12px rgba(34,26,21,.35);transform:translateY(104%);transition:transform .5s cubic-bezier(.2,.9,.25,1)}
.sheet--up{transform:none}
@media (prefers-reduced-motion:reduce){.sheet{transition:none}}
@media (min-width:640px){.sheet{bottom:1.5rem;border-radius:30px}}
.sheet__grab{display:block;width:42px;height:5px;border-radius:3px;background:rgba(34,26,21,.18);margin:.6rem auto 0;flex:0 0 auto}
.sheet__body{overflow-y:auto;padding:.7rem 1.2rem .5rem;-webkit-overflow-scrolling:touch}
.sheet__top{display:flex;gap:.85rem;align-items:flex-start}
.sheet__mise{flex:0 0 auto;margin-top:-.2rem}
.sheet__note{margin:0 0 .35rem;font-size:.85rem;font-weight:800;color:#573C56}
.sheet__h{margin:0;font-weight:900;font-size:1.5rem;line-height:1.15;letter-spacing:-.025em}
.hl{color:#B44722;white-space:nowrap}
.sheet__sub{margin:.3rem 0 0;font-weight:700;font-size:.88rem;line-height:1.4;color:#51453D}

.ben{list-style:none;margin:.85rem 0 0;padding:0;display:flex;gap:.4rem;flex-wrap:wrap}
.ben li{display:flex;gap:.35rem;align-items:center;font-weight:800;font-size:.8rem;background:rgba(180,71,34,.07);border-radius:99px;padding:.25rem .65rem .25rem .3rem}
.ben__i{width:22px;height:22px;border-radius:50%;background:#fff;color:#B44722;display:grid;place-items:center;flex:0 0 auto}
.ben__i svg{width:14px;height:14px}

.plans{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:1.1rem}
.plan{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:.05rem;text-align:left;font:inherit;color:inherit;cursor:pointer;
  padding:.85rem .85rem .75rem;border-radius:18px;background:#fff;border:2px solid rgba(34,26,21,.13);transition:border-color .15s,box-shadow .15s,background .15s}
.plan--on{border-color:#B44722;background:rgba(180,71,34,.045);box-shadow:0 10px 24px -16px rgba(180,71,34,.7)}
.plan__dot{position:absolute;top:.8rem;right:.8rem;width:20px;height:20px;border-radius:50%;border:2px solid #8A7D75;box-sizing:border-box;transition:border .15s}
.plan--on .plan__dot{border:6px solid #B44722}
.plan__badge{position:absolute;top:-.6rem;left:.7rem;font-size:.68rem;font-weight:900;color:#fff;background:#573C56;border-radius:99px;padding:.15rem .5rem}
.plan__l{font-weight:900;font-size:.88rem;color:#573C56}
.plan__p{font-weight:900;font-size:1.45rem;letter-spacing:-.02em;white-space:nowrap;line-height:1.15}
.plan__p small{font-size:.75rem;font-weight:800;color:#72645C;letter-spacing:0}
.plan__eq{font-size:.78rem;font-weight:700;color:#72645C}

.tl{list-style:none;margin:1rem 0 .2rem;padding:0;display:grid;grid-template-columns:repeat(3,1fr);position:relative}
.tl::before{content:"";position:absolute;left:7px;right:calc(33.3% - 7px);top:6px;height:2px;background:linear-gradient(90deg,#B44722,rgba(34,26,21,.18))}
.tl__i{position:relative;display:flex;flex-direction:column;gap:.1rem;padding-right:.4rem;font-size:.76rem;font-weight:700;color:#51453D;line-height:1.3}
.tl__i strong{color:#221A15;font-weight:900;font-size:.82rem;margin-top:.35rem}
.tl__dot{position:relative;z-index:1;width:14px;height:14px;border-radius:50%;background:#FFFFFF;border:3px solid rgba(34,26,21,.25);box-sizing:border-box}
.tl__i--now .tl__dot{background:#B44722;border-color:#B44722}
.renew{margin:1rem 0 0;font-weight:700;font-size:.88rem;color:#51453D}

.sheet__foot{padding:.5rem 1.2rem calc(.7rem + env(safe-area-inset-bottom));background:#FFFFFF;border-radius:0 0 30px 30px}
.cta{display:block;width:100%;box-sizing:border-box;text-align:center;text-decoration:none;padding:.95rem;border-radius:18px;border:0;cursor:pointer;
  background:#B44722;color:#fff;font:900 1.08rem 'Nunito',system-ui,sans-serif;letter-spacing:-.005em;
  box-shadow:0 2px 0 #813318,inset 0 1px 0 rgba(255,255,255,.25),0 14px 30px -14px rgba(180,71,34,.75);transition:transform .12s}
.cta:active{transform:translateY(2px)}
.cta:disabled{opacity:.65;cursor:wait}
.fine{margin:.55rem 0 0;text-align:center;font-size:.76rem;font-weight:600;color:#51453D;line-height:1.45}
.fine a{color:#51453D;font-weight:800}
.links{margin:.15rem 0 0;text-align:center;font-size:.85rem;color:#72645C}
.lnk{background:none;border:0;padding:.35rem .2rem;font:800 .85rem 'Nunito',system-ui,sans-serif;color:#9A3B1B;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.code{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.6rem}
.code input{flex:1;min-width:0;min-height:44px;border-radius:12px;border:1px solid #8A7D75;padding:0 .8rem;font:800 .95rem 'Nunito',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#221A15;background:#fff}
.code input::placeholder{letter-spacing:0;text-transform:none;color:#72645C;font-weight:700}
.code button{min-height:44px;padding:0 1rem;border-radius:12px;border:2px solid #221A15;background:#fff;color:#221A15;font:800 .9rem 'Nunito',system-ui,sans-serif;cursor:pointer}
.code button:disabled{opacity:.5;cursor:default}
.code__err{flex-basis:100%;margin:0;color:#7A2E1B;font-weight:700;font-size:.85rem}
.err{margin:0 0 .6rem;color:#7A2E1B;font-weight:700;font-size:.9rem;background:rgba(238,146,101,.2);border:1px solid #EE9265;border-radius:12px;padding:.55rem .7rem}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sheet button:focus-visible,.sheet a:focus-visible,.sheet input:focus-visible{outline:3px solid #B44722;outline-offset:2px}
`;
