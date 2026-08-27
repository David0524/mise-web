"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { S } from "@/lib/authStyles";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create your account.");
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
    <main style={S.wrap}>
      <form onSubmit={submit} style={S.card}>
        <h1 style={S.h1}>Create your account</h1>
        {err && <p style={S.error}>{err}</p>}
        <label style={S.label}>Email</label>
        <input style={S.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label style={S.label}>Password</label>
        <input style={S.input} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <p style={{ ...S.foot, textAlign: "left", marginTop: 6 }}>At least 8 characters.</p>
        <button style={S.btn} disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p style={S.foot}>Already have one? <a href="/login" style={S.link}>Sign in</a></p>
      </form>
    </main>
  );
}
