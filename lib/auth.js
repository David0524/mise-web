import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query } from "./db";

const COOKIE = "mise_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET);

/* bcrypt only ever reads the first 72 BYTES of a password and silently ignores
   the rest — so "<72 chars>SECRET" and "<72 chars>anything" were the same
   password. Reject instead of truncating; 72 bytes is 18 emoji, not 72. */
export const PASSWORD_MAX_BYTES = 72;
export const passwordBytes = (pw) => new TextEncoder().encode(pw).length;

/* Shared shape check for both auth routes. Type confusion (a number, array or
   object where a string belongs) used to throw deep inside toLowerCase or
   bcrypt and come back as a 500. */
export function readCredentials(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  return { email, password };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Login throttling. In-memory, so per server instance: on serverless that is a
   speed bump rather than a wall, but it turns "unlimited guesses per second"
   into a handful per minute per account and per address without adding
   infrastructure. Keyed on both so one attacker can't lock a victim out from
   everywhere and can't spray one password across many accounts either. */
const g = globalThis;
const attempts = g.__miseLoginAttempts || (g.__miseLoginAttempts = new Map());
const WINDOW_MS = 15 * 60 * 1000;
// Per account it's tight; per address it's looser, since a household or an
// office shares one.
const maxFails = (key) => (key.startsWith("ip:") ? 30 : 8);

export function loginBlocked(keys) {
  const now = Date.now();
  return keys.some((k) => {
    const a = attempts.get(k);
    if (!a || now - a.first > WINDOW_MS) return false;
    return a.fails >= maxFails(k);
  });
}

export function recordLoginFailure(keys) {
  const now = Date.now();
  for (const k of keys) {
    const a = attempts.get(k);
    if (!a || now - a.first > WINDOW_MS) attempts.set(k, { first: now, fails: 1 });
    else a.fails += 1;
  }
  // Keep the map from growing without bound on a long-lived instance.
  if (attempts.size > 10000) {
    for (const [k, a] of attempts) if (now - a.first > WINDOW_MS) attempts.delete(k);
  }
}

export function clearLoginFailures(keys) {
  keys.forEach((k) => attempts.delete(k));
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    // A per-session id, so logout can revoke exactly this token.
    .setJti(crypto.randomUUID())
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

/* Deleting the cookie only forgets the token in THIS browser — a copy of it
   stays valid until it expires. Record the token's id as revoked so
   getSessionUserId refuses it everywhere. */
export async function clearSession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      if (payload.jti && payload.exp) {
        await query(
          `insert into revoked_sessions (jti, expires_at) values ($1, to_timestamp($2))
           on conflict do nothing`,
          [payload.jti, payload.exp]
        );
        // Opportunistic cleanup; a revoked token past its own expiry is dead anyway.
        await query(`delete from revoked_sessions where expires_at < now()`);
      }
    } catch (e) {
      console.error("logout revocation failed:", e?.code || "", e?.message || e);
    }
  }
  cookies().delete(COOKIE);
}

/* Returns the logged-in user's id, or null. Never throws — an expired or
   tampered cookie just means "not logged in," not a 500. */
export async function getSessionUserId() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.uid) return null;
    if (payload.jti && (await isRevoked(payload.jti))) return null;
    return payload.uid;
  } catch (_) {
    return null;
  }
}

async function isRevoked(jti) {
  try {
    const { rows } = await query(`select 1 from revoked_sessions where jti = $1`, [jti]);
    return rows.length > 0;
  } catch (e) {
    // A database that hasn't had the revoked_sessions migration yet shouldn't
    // log everyone out — fail open on this one check and say so.
    console.error("revocation check failed:", e?.code || "", e?.message || e);
    return false;
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
