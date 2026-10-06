import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getSessionUserId, verifyPassword, clearSession,
  loginBlocked, recordLoginFailure, clearLoginFailures,
} from "@/lib/auth";

/* Deletes the signed-in account and everything stored for it.

   Order matters. Billing goes first: if Stripe can't be reached we stop and
   say so, because deleting the account but leaving the subscription running
   would keep charging someone who can no longer sign in to cancel. Then the
   users row, which cascades to every table holding their data (see
   prisma/schema.sql). Then the session is revoked. Password required, so a
   borrowed unlocked phone can't do it in one tap. */
export async function POST(req) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";
    const keys = [`delete:${userId}`];
    if (loginBlocked(keys)) {
      return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
    }

    const { rows } = await query(
      `select u.password_hash, s.stripe_customer_id
         from users u left join subscriptions s on s.user_id = u.id where u.id = $1`,
      [userId]
    );
    const row = rows[0];
    if (!row) { await clearSession(); return NextResponse.json({ ok: true }); }
    if (!password || !(await verifyPassword(password, row.password_hash))) {
      recordLoginFailure(keys);
      return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
    }
    clearLoginFailures(keys);

    if (row.stripe_customer_id) {
      try {
        const { stripe } = await import("@/lib/stripe");
        // Deleting the customer cancels its subscriptions immediately and
        // removes saved cards. Stripe keeps the payment records it's legally
        // required to.
        await stripe.customers.del(row.stripe_customer_id);
      } catch (e) {
        if (e?.code !== "resource_missing") {
          console.error("account delete: stripe failed:", e?.type || e?.code || "", e?.message || e);
          return NextResponse.json(
            { error: "We couldn't cancel your subscription with our payment provider just now, so nothing was deleted. Try again in a moment." },
            { status: 502 }
          );
        }
      }
    }

    await query("delete from users where id = $1", [userId]);
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("account delete failed:", e?.code || "", e?.message || e);
    return NextResponse.json({ error: "Something went wrong deleting your account. Nothing was deleted. Try again in a moment." }, { status: 500 });
  }
}
