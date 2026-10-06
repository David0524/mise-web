import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query } from "./db";
import { ensureSchema } from "./schema";

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
  // Bring the database up to date on the first signed-in request of each
  // server instance (a no-op read after that), so no route depends on
  // someone having re-run schema.sql by hand.
  await ensureSchema().catch(() => {});
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.uid) return null;
    if (await isRevoked(payload)) return null;
    return payload.uid;
  } catch (_) {
    return null;
  }
}

/* Dead if this token was logged out, or if it was issued before the account's
   cut-off (a password reset signs out every other device). */
async function isRevoked(payload) {
  try {
    const { rows } = await query(
      `select exists(select 1 from revoked_sessions where jti = $1) as revoked,
              (select tokens_valid_after from users where id = $2) as cutoff`,
      [payload.jti || "", payload.uid]
    ).catch((e) => {
      // Before the tokens_valid_after migration: still honour logouts.
      if (e?.code !== "42703") throw e;
      return query(`select exists(select 1 from revoked_sessions where jti = $1) as revoked, null as cutoff`, [payload.jti || ""]);
    });
    const r = rows[0];
    if (r?.revoked) return true;
    if (r?.cutoff && payload.iat && payload.iat * 1000 < new Date(r.cutoff).getTime()) return true;
    return false;
  } catch (e) {
    // A database that hasn't had the migrations yet shouldn't log everyone
    // out — fail open on this one check and say so.
    console.error("revocation check failed:", e?.code || "", e?.message || e);
    return false;
  }
}

/* The paywall gate: an active or trialing subscription, or an access code
   redeemed on the account (see lib/billing.js). Every page redirect and API
   gate funnels through here. There is deliberately no environment switch that
   turns the paywall off for everyone any more; testers use a code. */
export async function getEntitlement(userId) {
  const { rows } = await query(
    `select status, current_period_end, access_code from subscriptions where user_id = $1`,
    [userId]
  ).catch(async (e) => {
    // A database that hasn't had the access_code migration yet.
    if (e?.code !== "42703") throw e;
    return query(`select status, current_period_end, null as access_code from subscriptions where user_id = $1`, [userId]);
  });
  const sub = rows[0];
  if (sub?.access_code) return { active: true, status: "code", periodEnd: null };
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
