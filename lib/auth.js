import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query } from "./db";

const COOKIE = "mise_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

/* Returns the logged-in user's id, or null. Never throws — an expired or
   tampered cookie just means "not logged in," not a 500. */
export async function getSessionUserId() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.uid || null;
  } catch (_) {
    return null;
  }
}

/* The paywall gate. subscriptions.status is 'active' or 'trialing' means
   let them in — anything else (none, past_due, canceled) means show the
   upgrade screen instead of spending API budget on their behalf.

   SKIP_PAYWALL=1 bypasses this everywhere, since every call site here
   funnels through getEntitlement — the page redirect and the API gate both
   go through this one function. Nothing about Stripe or the subscriptions
   table is touched; turning billing back on for a real launch is deleting
   one env var, not undoing code. */
export async function getEntitlement(userId) {
  if (process.env.SKIP_PAYWALL === "1") {
    return { active: true, status: "testing", periodEnd: null };
  }
  const { rows } = await query(
    `select status, current_period_end from subscriptions where user_id = $1`,
    [userId]
  );
  const sub = rows[0];
  const active = sub && (sub.status === "active" || sub.status === "trialing");
  return { active: !!active, status: sub?.status || "none", periodEnd: sub?.current_period_end || null };
}

/* Shared guard for API routes: resolves the user and checks entitlement in
   one call, so every route that touches the model does it the same way. */
export async function requireEntitledUser() {
  const userId = await getSessionUserId();
  if (!userId) return { error: "unauthenticated", status: 401 };
  const ent = await getEntitlement(userId);
  if (!ent.active) return { error: "not_subscribed", status: 402 };
  return { userId };
}
