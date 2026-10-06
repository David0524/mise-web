import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { findOrCreate, takePending, safeNext } from "@/lib/identity";

/* Finishes a Google, Apple or phone sign-in for someone new, once they've
   ticked 18+ and agreed to the Terms. The identity itself comes only from the
   signed cookie the provider step set, never from this request. */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.ageConfirmed !== true || body?.termsAccepted !== true) {
      return NextResponse.json({ error: "Please confirm you're 18 or older and agree to the Terms." }, { status: 400 });
    }
    const pending = await takePending();
    if (!pending?.provider || !pending?.sub) {
      return NextResponse.json({ error: "That sign-in expired. Please start again." }, { status: 410 });
    }
    const res = await findOrCreate({ ...pending, consent: true });
    await createSession(res.userId);
    return NextResponse.json({ ok: true, next: safeNext(pending.next) });
  } catch (e) {
    console.error("consent failed:", e?.code || "", e?.message || e);
    return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
