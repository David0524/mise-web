# Mise — standalone web app

The App-Store-and-monetization version of Mise. Runs as a normal website
with your own backend, your own database, and Stripe subscriptions —
none of it depends on Claude.ai's artifact runtime.

## What changed from the artifact

- **The AI calls moved server-side** (`app/api/chat/route.js`). The browser
  never sees your Anthropic key.
- **Storage moved to Postgres** (`app/api/storage/route.js`), replacing
  `window.storage`, scoped per logged-in user.
- **The doctrine is still generated from the skill**, not retyped — see
  "Updating the cooking doctrine" below. This is the one thing that must
  never drift between the artifact and this app.
- **A real paywall exists now**, which was structurally impossible in the
  artifact version: `/app` is a Server Component that checks your session
  and Stripe subscription status before it ever sends the app's code to
  the browser.

## One-time setup (about 20 minutes)

1. **Database.** Create a free/cheap Postgres instance — Neon, Supabase, and
   Vercel Postgres all work with no code changes. Copy its connection
   string, then run the schema once:
   ```
   psql "$DATABASE_URL" -f prisma/schema.sql
   ```

2. **Anthropic API key.** Get one at console.anthropic.com. This is billed
   to you now — see the cost math below.

3. **Stripe.**
   - Create an account, create one Product with a monthly recurring Price,
     copy the Price id (`price_...`).
   - Add a webhook endpoint pointing at `https://yourdomain.com/api/stripe/webhook`,
     subscribed to: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`.
     Copy the signing secret (`whsec_...`).

4. **Copy `.env.example` to `.env.local`** and fill in all six values.
   Generate `SESSION_SECRET` with `openssl rand -base64 32`.

5. **Deploy.** Push this folder to a GitHub repo, connect it to Vercel,
   paste the same six env vars into Vercel's project settings, deploy.
   `npm run build` is what Vercel runs — it's already been verified to
   pass in this repo.

## Updating the cooking doctrine

The skill (`weekly-cooking-collaborator/SKILL.md`) is still the only place
cooking behavior should be edited. One build script now updates both the
artifact and this app in the same run:

```
python3 build_doctrine.py <path-to-artifact.jsx> <path-to-this-repo>/lib/doctrine.json
```

Never hand-edit `lib/doctrine.json`.

## What this does NOT include yet

This is deliberately just the backend/payment/PWA layer — step 1 of the
App Store plan. Not built yet, and not needed until there are paying users:
native voice (SFSpeechRecognizer), push notifications, a home-screen widget,
and the Capacitor wrap itself. Those are step 2.

## Cost reality

Every AI call now bills your Anthropic key directly — see the earlier cost
analysis: roughly $0.15–0.30 per week planned, per user, with caching and
model tiering already built into `/api/chat`. At $200k ARR scale this is a
small fraction of revenue, but it is now a real bill instead of a free ride
inside someone else's Claude subscription. Watch usage after launch.
