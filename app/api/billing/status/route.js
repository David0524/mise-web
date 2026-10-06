import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionUserId, getEntitlement } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

/* What the paywall and /auth/finish need: signed in or not, already entitled,
   whether setup is finished (if not, onboarding comes before the paywall),
   and whether the $1 first month is still on offer.

   A database hiccup must never read as "signed out": that used to send a
   signed-in person round in a loop between "Get started" and the paywall. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ signedIn: false, introEligible: true });
  const out = { signedIn: true, active: false, status: "none", introEligible: true, setupDone: true };
  try {
    await ensureSchema().catch(() => {});
    const ent = await getEntitlement(userId);
    out.active = ent.active; out.status = ent.status;
    const { rows } = await query(
      `select s.intro_used, s.stripe_subscription_id, p.data as profile
         from users u left join subscriptions s on s.user_id = u.id left join profiles p on p.user_id = u.id
        where u.id = $1`, [userId]
    ).catch(async (e) => {
      if (e?.code !== "42703") throw e; // intro_used not migrated yet
      return query(`select null as intro_used, s.stripe_subscription_id, p.data as profile
         from users u left join subscriptions s on s.user_id = u.id left join profiles p on p.user_id = u.id where u.id = $1`, [userId]);
    });
    const r = rows[0] || {};
    out.introEligible = !(r.intro_used || r.stripe_subscription_id);
    const prof = r.profile || {};
    out.setupDone = !!(prof.setupDone || (prof.profile?.nights?.length && prof.savedAt));
  } catch (e) {
    console.error("billing status failed:", e?.code || "", e?.message || e);
    out.error = e?.code || "unavailable";
  }
  return NextResponse.json(out);
}
