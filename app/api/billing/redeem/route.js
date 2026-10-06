import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionUserId, loginBlocked, recordLoginFailure, clearLoginFailures } from "@/lib/auth";
import { isAccessCode } from "@/lib/billing";
import { ensureSchema } from "@/lib/schema";

/* Redeem an access code (VIP26 by default) on the signed-in account. Guesses
   are throttled per account like passwords, so the code can't be brute-forced. */
export async function POST(req) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const keys = [`code:${userId}`];
    if (loginBlocked(keys)) {
      return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    if (!isAccessCode(body?.code)) {
      recordLoginFailure(keys);
      return NextResponse.json({ error: "That code isn't valid." }, { status: 400 });
    }
    clearLoginFailures(keys);
    await ensureSchema();
    await query(
      `insert into subscriptions (user_id, status, access_code, access_code_at) values ($1, 'none', $2, now())
       on conflict (user_id) do update set access_code = excluded.access_code, access_code_at = now(), updated_at = now()`,
      [userId, body.code.trim().toUpperCase()]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("redeem failed:", e?.code || "", e?.message || e);
    return NextResponse.json({ error: "Couldn't apply that code just now. Try again in a moment." }, { status: 500 });
  }
}
