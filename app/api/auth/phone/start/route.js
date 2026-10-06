import { NextResponse } from "next/server";
import { loginBlocked, recordLoginFailure } from "@/lib/auth";
import { normalizePhone, sendCode, smsConfigured } from "@/lib/messaging";

/* Texts a 6-digit code. Each send counts against the number and the address,
   so this can't be used to spam someone's phone or run up the SMS bill. */
export async function POST(req) {
  try {
    if (!smsConfigured()) {
      return NextResponse.json({ error: "Phone sign-in isn't set up yet. Use your email instead." }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(body?.phone);
    if (!phone) return NextResponse.json({ error: "Enter your mobile number with its country code, like +1 555 123 4567." }, { status: 400 });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const keys = [`sms:${phone}`, ...(ip ? [`ip:sms:${ip}`] : [])];
    if (loginBlocked(keys)) return NextResponse.json({ error: "Too many codes sent. Wait a few minutes and try again." }, { status: 429 });
    recordLoginFailure(keys);
    await sendCode(phone);
    return NextResponse.json({ ok: true, phone });
  } catch (e) {
    console.error("sms send failed:", e?.message || e);
    return NextResponse.json({ error: e?.status === 400 ? "That number can't receive texts." : "Couldn't send a code just now. Try again in a moment." }, { status: 502 });
  }
}
