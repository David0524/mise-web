import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/business";
import { ensureConsentColumns } from "@/lib/consent";
import {
  hashPassword, createSession, readCredentials, passwordBytes, PASSWORD_MAX_BYTES, EMAIL_RE,
} from "@/lib/auth";

export async function POST(req) {
  try {
  const body = await req.json().catch(() => ({}));
  const { email, password } = readCredentials(body);

  // The form requires both boxes; check again here so a direct POST can't skip them.
  if (body?.ageConfirmed !== true || body?.termsAccepted !== true) {
    return NextResponse.json(
      { error: "Please confirm you're 18 or older and agree to the Terms to create an account." },
      { status: 400 }
    );
  }

  if (!email || !password || password.length < 8 || !password.trim()) {
    return NextResponse.json(
      { error: "Enter an email and a password of at least 8 characters." },
      { status: 400 }
    );
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }
  if (passwordBytes(password) > PASSWORD_MAX_BYTES) {
    return NextResponse.json(
      { error: "That password is too long — keep it under 72 characters (fewer if it uses emoji)." },
      { status: 400 }
    );
  }

  const existing = await query("select id from users where email = $1", [email]);
  if (existing.rows.length) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const hash = await hashPassword(password);
  await ensureConsentColumns();
  const { rows } = await query(
    `insert into users (email, password_hash, age_confirmed_at, terms_accepted_at, policy_version)
     values ($1, $2, now(), now(), $3) returning id`,
    [email, hash, POLICY_VERSION]
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
    // Two signups for the same email at once both pass the existence check
    // above; the unique constraint catches the loser. That is a duplicate, not
    // a server fault.
    if (e?.code === "23505") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
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
