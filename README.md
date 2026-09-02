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
  the browser. `SKIP_PAYWALL=1` bypasses this everywhere for local testing.
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
— but it's Google's free tier: Flash/Flash-Lite only, modest rate limits,
and free-tier prompts may be used to improve Google's own products. Good
for demo/testing; the plan is to move to Claude before a real launch.
Model names for Gemini's free tier shift — `lib/providers/gemini.js` has
notes on this and needs occasional verification against your own AI Studio
console, not blind trust in whatever's documented here.

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
   `SESSION_SECRET` with `openssl rand -base64 32`. Set `SKIP_PAYWALL=1`
   while testing locally so you're not blocked by Stripe.

5. **Deploy.** Push this folder to a GitHub repo, connect it to Vercel,
   paste the same env vars into Vercel's project settings, deploy.
   `npm run build` is what Vercel runs.

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
