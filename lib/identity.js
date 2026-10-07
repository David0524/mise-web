import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { POLICY_VERSION } from "@/lib/business";
import { logEvent } from "@/lib/events";

/* Accounts that sign in with Google, Apple or a phone number.

   findOrCreate() resolves a verified identity to a user:
     1. an account already linked to it;
     2. else, for a provider-verified email, the existing account with that
        email (so someone who signed up with a password can later use Google);
     3. else a new account, but only if the person has ticked "18 or older"
        and agreed to the Terms. Without that the identity is parked in a
        short-lived signed cookie and the caller sends them to /auth/consent. */

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET);
const COLUMN = { google: "google_sub", apple: "apple_sub", phone: "phone" };
const PENDING = "mise_pending";

export async function findOrCreate({ provider, sub, email = null, emailVerified = false, consent = false }) {
  await ensureSchema();
  const col = COLUMN[provider];
  if (!col || !sub) throw new Error("bad identity");

  const linked = await query(`select id from users where ${col} = $1`, [sub]);
  if (linked.rows[0]) return { userId: linked.rows[0].id, created: false };

  const mail = typeof email === "string" ? email.trim().toLowerCase() : null;
  if (mail && emailVerified) {
    const byEmail = await query(`select id from users where email = $1`, [mail]);
    if (byEmail.rows[0]) {
      await query(`update users set ${col} = $1 where id = $2 and ${col} is null`, [sub, byEmail.rows[0].id]);
      return { userId: byEmail.rows[0].id, created: false };
    }
  }

  if (!consent) return { needsConsent: true };

  // Only keep an email the provider verified; an unverified one could belong
  // to someone else.
  const keepMail = mail && emailVerified ? mail : null;
  const { rows } = await query(
    `insert into users (email, ${col}, age_confirmed_at, terms_accepted_at, policy_version)
     values ($1, $2, now(), now(), $3) returning id`,
    [keepMail, sub, POLICY_VERSION]
  );
  await query(`insert into subscriptions (user_id, status) values ($1, 'none') on conflict do nothing`, [rows[0].id]);
  await logEvent(rows[0].id, "signup", { method: provider });
  return { userId: rows[0].id, created: true };
}

/* The identity waiting on consent: signed, httpOnly, ten minutes. */
export async function setPending(identity) {
  const token = await new SignJWT({ ...identity })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret());
  cookies().set(PENDING, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
  });
}
export async function takePending() {
  const token = cookies().get(PENDING)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch { return null; } finally { cookies().delete(PENDING); }
}

/* Short-lived signed state for an OAuth round trip (state, nonce, PKCE
   verifier, where to go after, whether consent was already given). Apple
   posts its answer back cross-site, which a SameSite=Lax cookie wouldn't
   survive, hence the option. */
export async function setOAuthState(name, data, { crossSite = false } = {}) {
  const token = await new SignJWT(data).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret());
  cookies().set(name, token, {
    httpOnly: true, path: "/", maxAge: 600,
    secure: crossSite || process.env.NODE_ENV === "production",
    sameSite: crossSite ? "none" : "lax",
  });
}
export async function takeOAuthState(name) {
  const token = cookies().get(name)?.value;
  cookies().delete(name);
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload; } catch { return null; }
}

export const randomToken = (bytes = 32) => Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
export async function sha256b64url(s) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))).toString("base64url");
}

/* Where to send someone after signing in. Only same-site paths, never
   "//evil.com" or a full URL. */
export function safeNext(next) {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next.slice(0, 200) : "";
}
export const appUrl = () => (process.env.APP_URL || "").replace(/\/$/, "");

/* A fake SMS/email channel for local testing. Refuses to run on an https
   APP_URL, so it can't be left switched on in production by accident. */
export function devFake(flag) {
  return process.env[flag] === "1" && !/^https:/i.test(process.env.APP_URL || "");
}
