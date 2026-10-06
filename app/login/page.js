"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";
import { BUSINESS } from "@/lib/business";
import AuthOptions, { useProviders } from "@/components/AuthOptions";

function LoginForm() {
  const params = useSearchParams();
  const next = /^\/(?![/\\])/.test(params.get("next") || "") ? params.get("next") : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(params.get("error") || "");
  const [busy, setBusy] = useState(false);
  const providers = useProviders();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      /* Never parse blindly. A route that crashes returns a 500 with an EMPTY
         body, and res.json() on that throws "Unexpected end of JSON input" —
         which is what the person saw instead of anything about what actually
         went wrong. Read the text first, then try to parse it. */
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
      if (!res.ok) {
        throw new Error(
          data.error ||
          (res.status >= 500
            ? "The server is having trouble right now. Try again in a moment."
            : "Couldn't sign in.")
        );
      }
      // /auth/finish brings over anything set up before signing in, then
      // goes to the app or the paywall.
      window.location.href = `/auth/finish${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column" }}>
      <FilterDefs />
      <div style={S.card}>
        <h1 style={S.h1}>Welcome back</h1>
        <p style={{ ...S.sub, marginBottom: "1rem" }}>Sign in to your kitchen.</p>
        {params.get("reason") === "expired" && (
          <p style={{ ...S.notice, marginBottom: 12 }}>You were signed out. Sign back in to keep going.</p>
        )}
        {params.get("reset") === "1" && (
          <p style={{ ...S.notice, marginBottom: 12 }}>Password changed. Any other devices have been signed out.</p>
        )}
        {err && <p style={{ ...S.error, marginBottom: 12 }} role="alert">{err}</p>}
        <AuthOptions from="/login" next={next} />
        <form onSubmit={submit} style={{ marginTop: 10 }}>
          <label htmlFor="email" style={{ ...S.label, marginTop: 0 }}>Email</label>
          <input id="email" autoComplete="email" style={S.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label htmlFor="password" style={S.label}>Password</label>
            {providers?.reset && <a href="/forgot" style={{ ...S.link, fontSize: ".85rem" }}>Forgot password?</a>}
          </div>
          <input id="password" autoComplete="current-password" style={S.input} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button style={S.btn} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        {providers && !providers.reset && (
          <p style={{ ...S.foot, marginTop: 12 }}>Forgot your password? Email <a href={`mailto:${BUSINESS.email}`} style={S.link}>{BUSINESS.email}</a> and we&apos;ll help.</p>
        )}
        <p style={S.foot}>New to Mise? <a href="/start" style={S.link}>Get started</a></p>
      </div>
      <SiteFooter />
    </main>
  );
}


// useSearchParams() opts a page out of static generation unless it's wrapped
// in Suspense — this is what "not found" flashes to while that resolves.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
