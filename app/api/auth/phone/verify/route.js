import { NextResponse } from "next/server";
import { createSession, loginBlocked, recordLoginFailure, clearLoginFailures } from "@/lib/auth";
import { normalizePhone, checkCode } from "@/lib/messaging";
import { findOrCreate, setPending } from "@/lib/identity";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(body?.phone);
    const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
    if (!phone || code.length < 4) return NextResponse.json({ error: "Enter the code we texted you." }, { status: 400 });
    const keys = [`otp:${phone}`];
    if (loginBlocked(keys)) return NextResponse.json({ error: "Too many tries. Ask for a new code in a few minutes." }, { status: 429 });
    if (!(await checkCode(phone, code))) {
      recordLoginFailure(keys);
      return NextResponse.json({ error: "That code isn't right, or it's expired." }, { status: 401 });
    }
    clearLoginFailures(keys);
    const consent = body?.ageConfirmed === true && body?.termsAccepted === true;
    const res = await findOrCreate({ provider: "phone", sub: phone, consent });
    if (res.needsConsent) {
      await setPending({ provider: "phone", sub: phone });
      return NextResponse.json({ needsConsent: true });
    }
    await createSession(res.userId);
    return NextResponse.json({ ok: true, created: res.created });
  } catch (e) {
    console.error("sms verify failed:", e?.message || e);
    return NextResponse.json({ error: "Couldn't check that code just now. Try again in a moment." }, { status: 502 });
  }
}
