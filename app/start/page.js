import { redirect } from "next/navigation";
import { getSessionUserId, getEntitlement } from "@/lib/auth";
import MiseApp from "@/components/MiseApp";

export const metadata = { title: "Get started — Mise" };

/* Onboarding, before there's an account: the intro, setting up your kitchen,
   a tour of the app, then making the account. Answers are kept on the device
   until then. Someone already signed in skips straight past it. */
export default async function StartPage() {
  const userId = await getSessionUserId();
  if (userId) {
    const ent = await getEntitlement(userId).catch(() => ({ active: false }));
    redirect(ent.active ? "/app" : "/pricing");
  }
  return <MiseApp guest />;
}
