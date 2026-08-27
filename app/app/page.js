import { redirect } from "next/navigation";
import { getSessionUserId, getEntitlement } from "@/lib/auth";
import MiseApp from "@/components/MiseApp";

// Server Component: the auth and paywall check happen before any client
// JavaScript ships, so an unentitled visitor never even receives the app's
// code, let alone a chance to poke at it in dev tools.
export default async function AppPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const entitlement = await getEntitlement(userId);
  if (!entitlement.active) redirect("/pricing?reason=required");

  return <MiseApp />;
}
