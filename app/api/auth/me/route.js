import { NextResponse } from "next/server";
import { getSessionUserId, getEntitlement } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ user: null });

  const [{ rows }, entitlement] = await Promise.all([
    query("select email from users where id = $1", [userId]),
    getEntitlement(userId),
  ]);

  if (!rows[0]) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { email: rows[0].email }, entitlement });
}
