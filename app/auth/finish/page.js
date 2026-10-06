"use client";
import { useEffect, useState } from "react";
import { S, FilterDefs } from "@/lib/authStyles";
import MiseHello from "@/components/MiseHello";
import { migrateGuestData } from "@/lib/guest";

/* Every sign-in and sign-up lands here. It brings over anything set up during
   onboarding before there was an account, then goes on to the app, or to the
   paywall if there's no subscription yet. */
export default function Finish() {
  const [msg, setMsg] = useState("Setting up your kitchen…");
  useEffect(() => {
    (async () => {
      try { await migrateGuestData(); } catch (_) { /* nothing to bring over, or it'll be re-asked in setup */ }
      let dest = "/pricing";
      try {
        const s = await (await fetch("/api/billing/status")).json();
        if (!s.signedIn) dest = "/login";
        else if (s.active) dest = "/app";
      } catch (_) { setMsg("Taking you to Mise…"); }
      const next = new URLSearchParams(window.location.search).get("next");
      if (dest === "/app" && next && /^\/(?![/\\])/.test(next)) dest = next;
      window.location.replace(dest);
    })();
  }, []);
  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column" }}>
      <FilterDefs />
      <div style={{ ...S.card, textAlign: "center" }} role="status">
        <MiseHello size={84} />
        <p style={{ ...S.sub, margin: "1rem 0 0" }}>{msg}</p>
      </div>
    </main>
  );
}
