import { NextResponse } from "next/server";
import { getSessionUserId, getEntitlement } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ user: null });

  const [{ rows }, entitlement] = await Promise.all([
    query("select email, (password_hash is not null) as has_password from users where id = $1", [userId]),
    getEntitlement(userId),
  ]);

  if (!rows[0]) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { email: rows[0].email, hasPassword: rows[0].has_password }, entitlement });
}
