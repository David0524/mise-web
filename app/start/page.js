import { redirect } from "next/navigation";
import { getSessionUserId, getEntitlement } from "@/lib/auth";
import { query } from "@/lib/db";
import MiseApp from "@/components/MiseApp";

export const metadata = { title: "Get started — Mise" };

/* Onboarding always comes before the paywall: the intro, setting up your
   kitchen, a tour of the app, then the account (if there isn't one yet), then
   the plan.
   - No account: everything is kept on the device until sign-up.
   - Signed in but setup not finished (an account made before this flow, or one
     that skipped it): the same onboarding, saved to the account, ending at the
     paywall instead of the sign-up step.
   - Signed in and set up: straight to the app, or the paywall. */
export default async function StartPage() {
  const userId = await getSessionUserId();
  if (!userId) return <MiseApp guest />;

  const ent = await getEntitlement(userId).catch(() => ({ active: false }));
  if (ent.active) redirect("/app");
  let setupDone = false;
  try {
    const { rows } = await query(`select data from profiles where user_id = $1`, [userId]);
    const d = rows[0]?.data || {};
    setupDone = !!(d.setupDone || (d.profile?.nights?.length && d.savedAt));
  } catch (_) { /* can't tell: let them through onboarding rather than bounce */ }
  if (setupDone) redirect("/pricing");
  return <MiseApp onboarding />;
}
