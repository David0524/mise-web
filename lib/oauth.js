import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8 } from "jose";
import { createSession } from "@/lib/auth";
import { findOrCreate, setPending, setOAuthState, takeOAuthState, randomToken, sha256b64url, safeNext, appUrl } from "@/lib/identity";

/* Sign in with Google and Sign in with Apple, both plain OpenID Connect
   authorization-code flows. No SDK: the id_token is verified here against the
   provider's published keys, issuer, audience and our nonce. */

const PROVIDERS = {
  google: {
    configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    jwks: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: async () => process.env.GOOGLE_CLIENT_SECRET,
    scope: "openid email profile",
    pkce: true,
    crossSite: false,
    extra: { prompt: "select_account" },
  },
  apple: {
    configured: () => !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
    authorize: "https://appleid.apple.com/auth/authorize",
    token: "https://appleid.apple.com/auth/token",
    jwks: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    issuer: "https://appleid.apple.com",
    clientId: () => process.env.APPLE_CLIENT_ID,
    // Apple's client secret is a JWT we sign with the .p8 key from the
    // developer account (APPLE_PRIVATE_KEY, newlines as \n are fine).
    clientSecret: async () => {
      const key = await importPKCS8(process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"), "ES256");
      return new SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID })
        .setIssuer(process.env.APPLE_TEAM_ID).setSubject(process.env.APPLE_CLIENT_ID)
        .setAudience("https://appleid.apple.com").setIssuedAt().setExpirationTime("5m")
        .sign(key);
    },
    scope: "name email",
    pkce: false,
    crossSite: true, // response_mode=form_post is a cross-site POST
    extra: { response_mode: "form_post" },
  },
};

const NAMES = { google: "Google", apple: "Apple" };
const back = (path, msg) => NextResponse.redirect(`${appUrl()}${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}`, 303);

export async function start(provider, req) {
  const p = PROVIDERS[provider];
  const url = new URL(req.url);
  const from = safeNext(url.searchParams.get("from")) || "/login";
  if (!p.configured()) return back(from, `Sign in with ${NAMES[provider]} isn't set up yet. Use your email instead.`);

  const state = randomToken(16), nonce = randomToken(16), verifier = randomToken(32);
  await setOAuthState(`mise_oauth_${provider}`, {
    state, nonce, verifier, from,
    consent: url.searchParams.get("consent") === "1",
    next: safeNext(url.searchParams.get("next")),
  }, { crossSite: p.crossSite });

  const q = new URLSearchParams({
    client_id: p.clientId(),
    redirect_uri: `${appUrl()}/api/auth/${provider}/callback`,
    response_type: "code",
    scope: p.scope,
    state, nonce,
    ...p.extra,
  });
  if (p.pkce) { q.set("code_challenge", await sha256b64url(verifier)); q.set("code_challenge_method", "S256"); }
  return NextResponse.redirect(`${p.authorize}?${q}`, 303);
}

export async function callback(provider, params) {
  const p = PROVIDERS[provider];
  const saved = await takeOAuthState(`mise_oauth_${provider}`);
  const from = saved?.from || "/login";
  try {
    if (params.get("error")) return back(from, params.get("error") === "access_denied" || params.get("error") === "user_cancelled_authorize"
      ? "Sign-in was cancelled." : `${NAMES[provider]} sign-in didn't work. Try again.`);
    if (!saved || !params.get("state") || params.get("state") !== saved.state) {
      return back(from, "That sign-in link expired. Try again.");
    }
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: params.get("code") || "",
      redirect_uri: `${appUrl()}/api/auth/${provider}/callback`,
      client_id: p.clientId(),
      client_secret: await p.clientSecret(),
    });
    if (p.pkce) body.set("code_verifier", saved.verifier);
    const r = await fetch(p.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15000) });
    const tok = await r.json().catch(() => ({}));
    if (!r.ok || !tok.id_token) throw new Error(`token exchange ${r.status} ${tok.error || ""}`);

    const { payload } = await jwtVerify(tok.id_token, p.jwks, { issuer: p.issuer, audience: p.clientId() });
    if (payload.nonce !== saved.nonce) throw new Error("nonce mismatch");
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";

    const identity = { provider, sub: String(payload.sub), email: payload.email || null, emailVerified };
    const res = await findOrCreate({ ...identity, consent: !!saved.consent });
    if (res.needsConsent) {
      await setPending({ ...identity, next: saved.next || "" });
      return NextResponse.redirect(`${appUrl()}/auth/consent`, 303);
    }
    await createSession(res.userId);
    const next = saved.next ? `?next=${encodeURIComponent(saved.next)}` : "";
    return NextResponse.redirect(`${appUrl()}/auth/finish${next}`, 303);
  } catch (e) {
    console.error(`${provider} sign-in failed:`, e?.code || "", e?.message || e);
    return back(from, `${NAMES[provider]} sign-in didn't work. Try again, or use your email.`);
  }
}
