# Mise — standalone web app

The App-Store-and-monetization version of Mise. Runs as a normal website
with your own backend, your own database, and Stripe subscriptions —
none of it depends on Claude.ai's artifact runtime. A Capacitor iOS wrapper
lives in `ios/` for the native build.

## What changed from the artifact

- **The AI calls moved server-side** (`app/api/chat/route.js`). The browser
  never sees a server-held API key.
- **Storage moved to Postgres** (`app/api/storage/route.js`), replacing
  `window.storage`, scoped per logged-in user.
- **The doctrine is still generated from the skill**, not retyped — see
  "Updating the cooking doctrine" below. This is the one thing that must
  never drift between the artifact and this app.
- **A real paywall exists now**, which was structurally impossible in the
  artifact version: `/app` is a Server Component that checks your session
  and Stripe subscription status before it ever sends the app's code to
  the browser. There's no switch to turn it off: testers use an access code
  (`VIP26` by default) on the paywall's "Have a code?" link.
- **Three interchangeable AI providers**, not one. `lib/providers/{gemini,
  anthropic,openai}.js` all take the same `(messages, systemBlocks, opts)`
  shape and return the same plain string, so nothing upstream — any prompt
  in `components/MiseApp.jsx`, the doctrine, `parseJSON`'s repair logic —
  is aware which one actually answered. `AI_PROVIDER` picks the server's
  default; see below.
- **Bring-your-own-key.** A user can hand the app their own OpenAI or
  Anthropic key from **My Kitchen** instead of using the server's. It's
  kept in browser `localStorage`, sent with each request, used once, and
  never written to the database — see the BRING YOUR OWN KEY block in
  `.env.example`.
- **The system prompt is sliced per call, not sent whole every time.**
  `lib/doctrine.js` exports `buildDoctrine(names)`; each call site in
  `MiseApp.jsx` asks for only the doctrine it actually needs (`core` plus
  `groceries` and/or `flavor`, depending on whether that call touches
  shopping, dish composition, or both). An unrecognized or empty list
  falls back to the full doctrine rather than running with none.

## Which AI provider you're using

**Gemini (the default)** is free — no credit card, via `aistudio.google.com`
— but it's Google's free tier: Flash/Flash-Lite only, and free-tier prompts
may be used to improve Google's own products. Good for demo/testing; the plan
is to move to Claude before a real launch. Two things worth knowing:

- Free-tier eligibility is per model *and per endpoint*. On the Flash models
  the Standard and Priority endpoints are free; Batch and Flex are paid-only.
- Rate limits apply **per Google Cloud project, not per API key**. Several
  keys from one project share one quota, so `GEMINI_API_KEYS` only helps if
  the keys come from different Google accounts. Google no longer publishes
  per-model free-tier RPM/RPD numbers — check your own at
  `aistudio.google.com/rate-limit`.
- **The free tier will not carry real users.** Measured on 2026-10-05: the
  main model (`gemini-3.6-flash`) allowed **20 requests per day per project**,
  shared by everyone using the app. Planning one week takes roughly 6–10 of
  them (ideas, the shopping list, a recipe per dish, any rewrites), so that is
  two or three planned weeks a day in total. `gemini-3.5-flash-lite` has its own,
  larger allowance, and the provider falls back to it when the main model
  returns 429 or 503 — at a noticeable cost in plan quality. Enable billing on
  the project (or switch to Anthropic) before anyone but you uses it.

Model names in this tier also shift fast (three Flash releases in six weeks
as of September 2026), so `lib/providers/gemini.js` needs occasional
verification against your own AI Studio console rather than blind trust in
whatever's written down. The notes in that file record which model is pinned
and why — including one earlier diagnosis that turned out not to hold up.

**Anthropic** is the real thing this is meant to run on eventually. It
bills your key directly — see "Cost reality" below.

Before wiring anything else up, sanity-check whichever provider you're
using in isolation:
```
GEMINI_API_KEY=your-real-key node scripts/test-gemini.mjs
```
This calls the exact provider module the app uses, no database or running
server involved. If it works, the wiring is correct and any later problem
is somewhere else — auth, storage, a specific prompt.

## One-time setup (about 20 minutes)

1. **Database.** Create a free/cheap Postgres instance — Neon, Supabase, and
   Vercel Postgres all work with no code changes. Copy its connection
   string, then run the schema once:
   ```
   psql "$DATABASE_URL" -f prisma/schema.sql
   ```
   The file is safe to re-run, and **must be re-run on an existing database
   after pulling changes to it** — later additions (the recipe book, the
   week-in-progress table, webhook event ordering, logout revocation) are
   appended as `create ... if not exists` / `add column if not exists`.

2. **An AI key.** Either a free Gemini key from `aistudio.google.com/apikey`
   (comma-separate several as `GEMINI_API_KEYS` if you have them — they
   rotate on rate limits), or an Anthropic key from `console.anthropic.com`
   if you're setting `AI_PROVIDER=anthropic`. You don't need both.

3. **Stripe.**
   - Create an account, create one Product with a monthly recurring Price,
     copy the Price id (`price_...`).
   - Add a webhook endpoint pointing at `https://yourdomain.com/api/stripe/webhook`,
     subscribed to: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`.
     Copy the signing secret (`whsec_...`).

4. **Copy `.env.example` to `.env.local`** and fill it in — see the comments
   on each variable there for what's required vs. optional. Generate
   `SESSION_SECRET` with `openssl rand -base64 32`. Locally, get past the
   paywall with the access code `VIP26`.

5. **Deploy.** Push this folder to a GitHub repo, connect it to Vercel,
   paste the same env vars into Vercel's project settings, deploy.
   `npm run build` is what Vercel runs.

## Trying Mistral (free tier, testing only)

Set `AI_PROVIDER=mistral` and `MISTRAL_API_KEY` (console.mistral.ai → API Keys,
on the free "Experiment" plan). Uses `mistral-large-latest`, with
`mistral-small-latest` for light calls; override with `MISTRAL_MODEL` /
`MISTRAL_FAST_MODEL`. The free plan requires letting Mistral train on what's
sent, so use it with test data only. Switch back with `AI_PROVIDER=gemini`.

## Usage limits

Each account can make up to 120 AI calls per 10 minutes and 600 per day, and
200 voice clips per 10 minutes and 1,500 per day. A heavy planning session is a
few dozen calls, so these only stop runaway or scripted use. Calls made on a
person's own API key aren't counted. Change them with `CHAT_LIMIT_10MIN`,
`CHAT_LIMIT_DAY`, `TTS_LIMIT_10MIN`, `TTS_LIMIT_DAY` (`lib/limits.js`).

## Checking a deployment

Open `/api/health` on any deployment. It says whether the database answers,
whether its schema is up to date (and which columns are missing if not),
whether SESSION_SECRET, APP_URL, the AI key and Stripe are set, and which
sign-in methods are configured. No secrets are shown.

## Onboarding, sign-in and the paywall

**The flow:** landing → `/start` (intro → kitchen setup → app tour → create
account) → `/pricing` (paywall) → `/app`. Onboarding always comes before the
paywall: an account that exists but hasn't finished setup is sent through the
same onboarding (saved to the account) and then to the paywall. Until the account exists, setup is
saved on the device (`mise:guest:*` in localStorage); `/auth/finish` copies it
to the new account after any sign-in, never overwriting an existing kitchen.

**Pricing** (`lib/billing.js`): $12/month or $120/year. New subscribers pay $1
for the first 30 days (a 30-day Stripe trial plus a one-time $1 line item),
once per account. Prices are defined inline, so only `STRIPE_SECRET_KEY` and the
webhook are required; set `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` to use
dashboard prices instead. Test a real checkout in Stripe test mode before launch.

**Access codes:** `ACCESS_CODES` (comma-separated, case-insensitive) unlocks the
app without paying. Defaults to `VIP26`. Redeemed codes are stored on the
account (`subscriptions.access_code`).

**Sign-in methods.** A button only appears once its variables are set (so
with none set, it's email and password only). "Forgot password?" appears once
email sending is set up; until then the sign-in page points to support.

| Method | Variables | Where to get them |
|---|---|---|
| Email + password | (none) | built in |
| Forgot password | `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Mise <hello@yourdomain.com>`) | resend.com, verify your domain |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client (Web). Redirect URI: `https://yourdomain.com/api/auth/google/callback` |
| Apple | `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (.p8 contents) | Apple Developer → Identifiers → Services ID with Sign in with Apple; Return URL: `https://yourdomain.com/api/auth/apple/callback` |
| Phone (SMS code) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` | Twilio Console → Verify → create a service |

`APP_URL` must be the exact public origin (it builds the callback URLs).

For local testing only, `DEV_FAKE_SMS=1` accepts the code `000000` and
`DEV_LOG_EMAILS=1` prints emails to the server log. Both refuse to run when
`APP_URL` is https.

Accounts link automatically: Google or Apple with a verified email matching an
existing account signs into that account. A password reset signs out every
other device. The whole schema applies itself on the first signed-in request (`lib/schema.js`), so a database set up from an older `schema.sql` catches up without re-running it.

## Legal, privacy and compliance

Policy pages: `/privacy`, `/terms`, `/refunds`, `/cookies`. Every public page
has a footer with the business details and policy links, and the site shows a
cookie banner (`components/CookieBanner.jsx`).

**Before launch, set these.** Until you do, the pages show FAKE stand-in
details (Mise Kitchen, Inc., a San Francisco address, support@misekitchen.app)
so they read finished during testing; a live legal page must name the real business. They're `NEXT_PUBLIC_`, so rebuild
after changing them:

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_BUSINESS_LEGAL_NAME` | `Mise Kitchen LLC` |
| `NEXT_PUBLIC_BUSINESS_ADDRESS` | `123 Main St, Austin, TX 78701, USA` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `help@yourdomain.com` |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | optional; defaults to the support email |
| `NEXT_PUBLIC_GOVERNING_LAW` | `the State of Texas, USA` |
| `NEXT_PUBLIC_PRICE_LABEL` | optional; defaults to `$12 per month` |
| `STRIPE_AUTOMATIC_TAX` | `1` once Stripe Tax is set up |

- Signup requires "I'm 18 or older" and agreeing to the Terms; both are checked
  again on the server and recorded on the `users` row (`age_confirmed_at`,
  `terms_accepted_at`, `policy_version`). Bump `POLICY_VERSION` in
  `lib/business.js` when a policy changes materially.
- Allergies and diets are only stored after an explicit tick at setup; unticking deletes them.
- People can download their data (`GET /api/account/export`) and delete their
  account (`POST /api/account/delete`, password required; deletes the Stripe
  customer, which cancels billing, then every row via `on delete cascade`).
  Both are in the app under My Kitchen → Account → Your data.
- The app sends no email. If you add any, include an unsubscribe link and only
  send marketing to people who opted in.
- Third parties and SDKs are listed in `docs/THIRD_PARTIES.md`. Use a paid
  Gemini tier for launch (the free tier may use prompts to improve Google products).
- Accessibility: `node qa/a11y.js` runs axe-core (WCAG 2.1 AA) on every page and
  checks keyboard basics.

Have a lawyer review the policies before launch; they're a strong, accurate
starting point written from what the code actually does, not legal advice.

## Updating the cooking doctrine

The skill (`weekly-cooking-collaborator/SKILL.md`, in the skill's own repo —
not part of this one) is still the only place cooking behavior should be
edited. Its `scripts/build_doctrine.py` updates both the artifact and this
app's `lib/doctrine.json` in the same run:

```
python3 build_doctrine.py <path-to-artifact.jsx> <path-to-this-repo>/lib/doctrine.json
```

Never hand-edit `lib/doctrine.json`. The build script emits it as named
slices (`core`, `groceries`, `flavor`) specifically so the app can load
only what a given call needs — `lib/doctrine.js`'s `buildDoctrine` and the
`docSlices` option on each call site in `MiseApp.jsx` are what actually use
that; if you add a new slice, calls that want it need to ask for it by name.

## What this does NOT include yet

Native voice (SFSpeechRecognizer), push notifications, and a home-screen
widget are not built. The Capacitor iOS project in `ios/` exists but hasn't
shipped — `capacitor.config.json` still points at a placeholder domain, and
App Store submission needs real native functionality beyond a WebView
wrapper for Guideline 4.2. None of this is needed until there are paying
users to justify it.

## Cost reality

On the Gemini default, calls are free (subject to free-tier rate limits and
Google's usage-for-improvement terms on that tier). Switching `AI_PROVIDER`
to `anthropic` bills your key directly — budget roughly $0.15–0.30 per week
planned, per user, with prompt caching and model tiering already built into
`/api/chat`. At meaningful scale that's a small fraction of a $12/month
subscription, but it's a real bill instead of a free tier, and worth
watching once real usage starts.

## Mise's voice (cook mode)

Cook mode reads each step aloud. With a neural voice configured it uses
`/api/tts` (see `lib/tts.js`); otherwise it falls back to the phone's built-in
voice.

- `OPENAI_API_KEY` set → OpenAI `gpt-4o-mini-tts` (best: natural, and it takes a
  direction for tone). Optional: `OPENAI_TTS_VOICE` (default `coral`),
  `OPENAI_TTS_MODEL`.
- otherwise, the existing `GEMINI_API_KEY(S)` → Gemini TTS
  (`gemini-2.5-flash-preview-tts`, voice `Sulafat`; override with
  `GEMINI_TTS_MODEL` / `GEMINI_TTS_VOICE`).
- `TTS_PROVIDER=openai|gemini|none` forces a choice.

Audio plays through an `<audio>` element in a "playback" audio session, so it
isn't muted by the iPhone's ring/silent switch. In the iOS app that's set
natively in `ios/App/App/AppDelegate.swift` (rebuild the app in Xcode to pick
it up); in Safari it uses `navigator.audioSession` (iOS 17+).
