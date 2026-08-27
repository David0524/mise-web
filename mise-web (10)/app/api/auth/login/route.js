import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const { rows } = await query(
    "select id, password_hash from users where email = $1",
    [email.toLowerCase()]
  );
  const user = rows[0];

  // Same message whether the email doesn't exist or the password is wrong —
  // don't let a login form confirm which emails have accounts.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
