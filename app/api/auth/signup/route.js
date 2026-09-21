import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req) {
  try {
  const { email, password } = await req.json().catch(() => ({}));

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Enter an email and a password of at least 8 characters." },
      { status: 400 }
    );
  }

  const existing = await query("select id from users where email = $1", [email.toLowerCase()]);
  if (existing.rows.length) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const hash = await hashPassword(password);
  const { rows } = await query(
    "insert into users (email, password_hash) values ($1, $2) returning id",
    [email.toLowerCase(), hash]
  );
  const userId = rows[0].id;

  // Every new account starts with no subscription row until they pay — the
  // paywall gate treats "no row" the same as "not entitled".
  await query(
    "insert into subscriptions (user_id, status) values ($1, 'none') on conflict do nothing",
    [userId]
  );

  await createSession(userId);
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
