import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req) {
  try {
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
} catch (e) {
    /* Any throw here used to escape the route, so Next returned a 500 with an
       EMPTY body — and the client called res.json() on it and died with
       "Unexpected end of JSON input", hiding the real cause completely.
       A route that the client parses as JSON must return JSON on every path. */
    console.error("auth route failure:", e?.code || "", e?.message || e);
    const config = e?.code === "NO_DATABASE_URL" || e?.code === "ECONNREFUSED";
    return NextResponse.json(
      { error: config
          ? "The server can't reach its database. This is a configuration problem, not your password."
          : "Something went wrong signing you in. Try again in a moment." },
      { status: config ? 503 : 500 }
    );
  }
}
