"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't change your password.");
      window.location.href = "/auth/finish";
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column" }}>
      <FilterDefs />
      <form onSubmit={submit} style={S.card}>
        <h1 style={S.h1}>Choose a new password</h1>
        <p style={S.sub}>This signs you out on every other device.</p>
        {!token && <p style={S.error}>This link is missing its code. <a href="/forgot" style={S.link}>Ask for a new one</a>.</p>}
        {err && <p style={S.error} role="alert">{err} {/expired|valid/.test(err) && <a href="/forgot" style={S.link}>Get a new link</a>}</p>}
        <label htmlFor="password" style={S.label}>New password</label>
        <input id="password" type="password" autoComplete="new-password" minLength={8} required style={S.input} value={pw} onChange={(e) => setPw(e.target.value)} />
        <p style={{ ...S.foot, textAlign: "left", marginTop: 6 }}>At least 8 characters.</p>
        <button style={S.btn} disabled={busy || !token}>{busy ? "Saving…" : "Save and sign in"}</button>
      </form>
      <SiteFooter />
    </main>
  );
}
export default function ResetPage() { return <Suspense fallback={null}><ResetForm /></Suspense>; }
