"use client";
import { useState } from "react";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";
import ConsentChecks from "@/components/ConsentChecks";

/* A new Google, Apple or phone sign-in that hasn't agreed to the Terms yet. */
export default function ConsentPage() {
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ageConfirmed: adult, termsAccepted: terms }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.href = `/auth/finish${data.next ? `?next=${encodeURIComponent(data.next)}` : ""}`;
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column" }}>
      <FilterDefs />
      <form onSubmit={submit} style={S.card}>
        <h1 style={S.h1}>One last thing</h1>
        <p style={S.sub}>Before we make your account:</p>
        {err && <p style={S.error} role="alert">{err} {/expired/.test(err) && <a href="/login" style={S.link}>Start again</a>}</p>}
        <ConsentChecks adult={adult} setAdult={setAdult} terms={terms} setTerms={setTerms} />
        <button style={S.btn} disabled={busy || !adult || !terms}>{busy ? "Creating…" : "Create my account"}</button>
      </form>
      <SiteFooter />
    </main>
  );
}
