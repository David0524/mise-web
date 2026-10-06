"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";
import { NewPasswordFields, credentialsReady } from "@/components/CredentialFields";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const ready = credentialsReady({ password: pw, confirm, needEmail: false });
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
        <div className="rs"><NewPasswordFields idPrefix="rs" password={pw} setPassword={setPw} confirm={confirm} setConfirm={setConfirm} /></div>
        <style dangerouslySetInnerHTML={{ __html: `.rs .cf label{display:block;font:800 .85rem 'Nunito',system-ui,sans-serif;color:#573C56;margin:16px 0 6px}
          .rs .cf input{width:100%;padding:.8rem .95rem;border-radius:16px;border:1px solid #8A7D75;background:rgba(255,255,255,.8);font:600 1rem 'Nunito',system-ui,sans-serif;color:#221A15;box-sizing:border-box}` }} />
        <button style={S.btn} disabled={busy || !token || !ready}>{busy ? "Saving…" : "Save and sign in"}</button>
      </form>
      <SiteFooter />
    </main>
  );
}
export default function ResetPage() { return <Suspense fallback={null}><ResetForm /></Suspense>; }
