import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionUserId, getEntitlement } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

/* What the paywall needs to render honestly: signed in or not, already
   entitled, and whether the $1 first month is still on offer. */
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ signedIn: false, introEligible: true });
    await ensureSchema();
    const ent = await getEntitlement(userId);
    const { rows } = await query(
      `select intro_used, stripe_subscription_id from subscriptions where user_id = $1`, [userId]
    );
    const r = rows[0];
    return NextResponse.json({
      signedIn: true,
      active: ent.active,
      status: ent.status,
      introEligible: !(r?.intro_used || r?.stripe_subscription_id),
    });
  } catch (e) {
    console.error("billing status failed:", e?.code || "", e?.message || e);
    return NextResponse.json({ signedIn: false, introEligible: true, error: "unavailable" }, { status: 500 });
  }
}
