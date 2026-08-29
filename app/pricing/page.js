"use client";
import { useState } from "react";
import { S, FilterDefs } from "@/lib/authStyles";

export default function PricingPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function subscribe() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      window.location.href = data.url; // hands off to Stripe Checkout
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <main style={S.wrap}>
      <FilterDefs />
      <div style={{ ...S.card, width: 380, textAlign: "center" }}>
        <h1 style={S.h1}>Mise</h1>
        <p style={{ fontFamily: "system-ui, sans-serif", color: "#4A4453", marginTop: -8 }}>
          A weekly cooking collaborator — plans the week, builds the list, talks you through cooking it.
        </p>
        {err && <p style={S.error}>{err}</p>}
        <div style={{ background: "#F4EBE9", borderRadius: 16, padding: "1.4rem", margin: "1.2rem 0" }}>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 32, fontWeight: 800, margin: 0, color: "#12141C" }}>
            $12<span style={{ fontSize: 15, fontWeight: 500, color: "#6E6472" }}>/month</span>
          </p>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 13.5, color: "#6E6472", margin: "6px 0 0" }}>
            Cancel anytime. Manage it yourself, no email required.
          </p>
        </div>
        <button style={S.btn} onClick={subscribe} disabled={busy}>
          {busy ? "Starting checkout…" : "Subscribe"}
        </button>
      </div>
    </main>
  );
}
