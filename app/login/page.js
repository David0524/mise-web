"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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
        <h1 style={S.h1}>Sign in</h1>
        {params.get("reason") === "expired" && (
          <p style={S.notice}>You were signed out. Sign back in to keep going.</p>
        )}
        {err && <p style={S.error}>{err}</p>}
        <label htmlFor="email" style={S.label}>Email</label>
        <input id="email" autoComplete="email" style={S.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password" style={S.label}>Password</label>
        <input id="password" autoComplete="current-password" style={S.input} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button style={S.btn} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p style={S.foot}>No account yet? <a href="/signup" style={S.link}>Sign up</a></p>
      </form>
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

