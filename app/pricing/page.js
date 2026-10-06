"use client";
import { useState } from "react";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";

export default function PricingPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function subscribe() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      // Never parse blindly — an error response may have an empty or non-JSON body.
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      window.location.href = data.url; // hands off to Stripe Checkout
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column" }}>
      <FilterDefs />
      <div style={{ ...S.card, width: 380, textAlign: "center" }}>
        <h1 style={S.h1}>Mise</h1>
        <p style={{ fontFamily: "system-ui, sans-serif", color: "#51453D", marginTop: -8 }}>
          A weekly cooking collaborator — plans the week, builds the list, talks you through cooking it.
        </p>
        {err && <p style={S.error}>{err}</p>}
        <div style={{ background: "#F4EBE9", borderRadius: 16, padding: "1.4rem", margin: "1.2rem 0" }}>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 32, fontWeight: 800, margin: 0, color: "#221A15" }}>
            $12<span style={{ fontSize: 15, fontWeight: 500, color: "#72645C" }}>/month</span>
          </p>
          <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 13.5, color: "#72645C", margin: "6px 0 0" }}>
            Cancel anytime. Manage it yourself, no email required.
          </p>
        </div>
        <ul style={{ fontFamily: "system-ui, sans-serif", fontSize: 13.5, lineHeight: 1.5, color: "#51453D", textAlign: "left", margin: "0 0 .4rem", paddingLeft: "1.1rem" }}>
          <li>Renews automatically every month at $12 until you cancel.</li>
          <li>Cancel in the app any time; you keep access until the end of the month you paid for.</li>
          <li>No setup or hidden fees. Any sales tax or VAT is shown at checkout before you pay.</li>
          <li>Not happy? Full refund within 14 days of your first payment.</li>
        </ul>
        <button style={S.btn} onClick={subscribe} disabled={busy}>
          {busy ? "Starting checkout…" : "Subscribe for $12/month"}
        </button>
        <p style={{ ...S.foot, fontSize: ".82rem", marginTop: 12 }}>
          By subscribing you agree to the <a href="/terms" style={S.link}>Terms</a> and{" "}
          <a href="/refunds" style={S.link}>Refund Policy</a>.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
