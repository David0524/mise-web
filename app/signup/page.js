"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";

const check = { display: "flex", gap: ".6rem", alignItems: "flex-start", marginTop: 14, fontWeight: 700, fontSize: ".92rem", lineHeight: 1.45, color: "#3B302A", cursor: "pointer", textAlign: "left" };
const box = { width: 22, height: 22, margin: "1px 0 0", flex: "0 0 auto", accentColor: "#B44722" };

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Unticked by default, and both required: agreeing has to be something the
  // person actually does. The server checks them again and records when.
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ageConfirmed: adult, termsAccepted: terms }),
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
            : "Couldn't create your account.")
        );
      }
      // /app itself checks entitlement server-side and redirects to /pricing if
      // needed — deferring to that one place means this works correctly whether
      // the paywall is on or off, without duplicating the logic here.
      router.push("/app");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column" }}>
      <FilterDefs />
      <form onSubmit={submit} style={S.card}>
        <h1 style={S.h1}>Create your account</h1>
        {err && <p style={S.error}>{err}</p>}
        <label htmlFor="email" style={S.label}>Email</label>
        <input id="email" autoComplete="email" style={S.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password" style={S.label}>Password</label>
        <input id="password" autoComplete="new-password" style={S.input} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <p style={{ ...S.foot, textAlign: "left", marginTop: 6 }}>At least 8 characters.</p>
        <label style={check}>
          <input type="checkbox" required checked={adult} onChange={(e) => setAdult(e.target.checked)} style={box} />
          <span>I&apos;m 18 or older.</span>
        </label>
        <label style={check}>
          <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} style={box} />
          <span>
            I agree to the <a href="/terms" target="_blank" rel="noopener" style={S.link}>Terms of Service</a> and
            have read the <a href="/privacy" target="_blank" rel="noopener" style={S.link}>Privacy Policy</a>.
          </span>
        </label>
        <button style={S.btn} disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p style={S.foot}>Already have one? <a href="/login" style={S.link}>Sign in</a></p>
      </form>
      <SiteFooter />
    </main>
  );
}
