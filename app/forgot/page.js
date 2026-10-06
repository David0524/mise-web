"use client";
import { useState } from "react";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send the email just now.");
      setDone(data.message);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column" }}>
      <FilterDefs />
      <form onSubmit={submit} style={S.card}>
        <h1 style={S.h1}>Forgot your password?</h1>
        <p style={S.sub}>Enter the email you signed up with and we&apos;ll send you a link to choose a new one.</p>
        {done ? (
          <p style={S.notice} role="status">{done}</p>
        ) : (
          <>
            {err && <p style={S.error} role="alert">{err}</p>}
            <label htmlFor="email" style={S.label}>Email</label>
            <input id="email" autoComplete="email" style={S.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button style={S.btn} disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </>
        )}
        <p style={S.foot}>Signed up with Google, Apple or your phone? Just use that button on <a href="/login" style={S.link}>sign in</a>.</p>
      </form>
      <SiteFooter />
    </main>
  );
}
