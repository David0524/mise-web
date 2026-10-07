# Mise

Mise is a weekly cooking companion: it plans a few dinners around your kitchen,
builds one shopping list where everything bought gets used, and talks you
through each recipe at the stove. A Next.js 14 (app router) web app on Postgres,
with a Stripe paywall and a Capacitor iOS wrapper in `ios/`.

## How deploys work

**Every push to `main` deploys straight to production on Vercel**, which runs
`npm run build`. Friends are using the live app, so work on a branch:
GitHub Actions (`.github/workflows/ci.yml`) builds, runs the unit tests and
runs the end-to-end smoke test on every push and pull request. Merge only when
it's green. After a deploy, open `/api/health` on the live site (below).

The database schema applies itself on the first request after a deploy
(`lib/schema.js`, additive `create … if not exists` / `add column if not
exists` only), so there's no migration step. `prisma/schema.sql` is the same
schema for setting up a database by hand.

## Local setup

Needs Node 20+ and Postgres.

```
npm install
# put the variables below in .env.local
npm run dev        # or: npm run build && npm start
```

Get past the paywall locally with the access code `VIP26` ("Have a code?" on
`/pricing`). Open `/api/health` to see what's configured: it reports the
database, schema, `SESSION_SECRET`, `APP_URL`, the AI key, Stripe and which
sign-in methods are on, without showing any secret.

### Environment variables

Required:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string (`postgres://…`; add `?sslmode=disable` for a local database). Neon/Vercel `POSTGRES_*` / `NEON_*` names also work. |
| `SESSION_SECRET` | Signs session cookies. Generate with `openssl rand -base64 32`. |
| `APP_URL` | The exact public origin, e.g. `http://localhost:3000`. Builds OAuth callback URLs. |
| `AI_PROVIDER` | `anthropic` (default), `gemini`, `openai` or `mistral`. |
| the provider's key | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (or several as `GEMINI_API_KEYS`, comma-separated), `OPENAI_API_KEY` or `MISTRAL_API_KEY`. |

Optional:

| Variables | What they turn on |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paid subscriptions ($12/month or $120/year, first 30 days $1; `lib/billing.js`). Webhook: `/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created/updated/deleted`. `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` use dashboard prices instead of the inline ones; `STRIPE_AUTOMATIC_TAX=1` once Stripe Tax is set up. |
| `ACCESS_CODES` | Comma-separated codes that unlock the app without paying (case-insensitive). Defaults to `VIP26`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Sign in with Google. Redirect URI `<APP_URL>/api/auth/google/callback`. |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Sign in with Apple. Return URL `<APP_URL>/api/auth/apple/callback`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` | Phone sign-in by SMS code. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Password-reset email ("Forgot password?" only appears once set). |
| `DEV_FAKE_SMS=1`, `DEV_LOG_EMAILS=1` | Local only: SMS code `000000`, emails printed to the log. Refused on an https `APP_URL`. |
| `GEMINI_MODEL`, `GEMINI_FAST_MODEL`, `MISTRAL_MODEL`, `MISTRAL_FAST_MODEL` | Override the pinned models (see the notes in `lib/providers/`). |
| `TTS_PROVIDER`, `OPENAI_TTS_VOICE`, `OPENAI_TTS_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE` | Cook mode's spoken voice (`lib/tts.js`): OpenAI if its key is set, else Gemini, else the phone's own voice. `TTS_PROVIDER=none` turns it off. |
| `CHAT_LIMIT_10MIN`, `CHAT_LIMIT_DAY`, `TTS_LIMIT_10MIN`, `TTS_LIMIT_DAY` | Per-account ceilings (defaults 40 / 150 AI calls and 200 / 1,500 voice clips; `lib/limits.js`). Calls on a person's own key aren't counted. |
| `ADMIN_EMAILS` | Who can open the private stats page `/admin` (comma-separated). |
| `NEXT_PUBLIC_BUSINESS_LEGAL_NAME`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_PRIVACY_EMAIL`, `NEXT_PUBLIC_GOVERNING_LAW`, `NEXT_PUBLIC_PRICE_LABEL` | The business details on the legal pages and footer (`lib/business.js`). The defaults are FAKE stand-ins; set the real ones before launch and rebuild. |

On the Gemini free tier the main model allows very few requests per day per
Google Cloud project (20 when measured on 2026-10-05; a planned week takes
6–10), so enable billing or use Anthropic before anyone but you uses it.
`GEMINI_API_KEY=… node scripts/test-gemini.mjs` checks a key against the
exact provider module the app uses, with no server or database.

## Tests

```
npm test
```

Unit tests for the pure modules in `lib/` (password and email rules, access
codes, doctrine slices, event allowlist and prop cleaning, redirects, phone
numbers), on Node's built-in test runner. `test/register.mjs` lets plain Node
load the app's files as Next does (the `@/` alias, ESM in `.js`, JSON imports),
so tests import the real modules unchanged. No database or network.

## QA scripts (`qa/`)

Browser-driven checks of the real app, using `playwright-core`
(`npm i --no-save playwright-core`) and a Chromium (`CHROMIUM=/path/to/chrome`;
the default is the one in Claude Code cloud containers). Point them at a
running app with `BASE_URL` (default `http://localhost:3000`). Output goes to
`qa/out/` (or `QA_OUT`). `qa/setup.sh` sets up Postgres, builds and starts the
app on :3000 in a fresh container.

| Command | What it measures | AI calls |
|---|---|---|
| `node qa/smoke.js` | One pass through the whole product as a new person: onboarding at `/start`, setup, tour, sign-up, paywall + `VIP26`, plan a week, shop, recipe, cook mode, ask Mise, new-week sheet. Fails on any page error or API 5xx. About 30 seconds; CI runs it. | 0 (fake model) |
| `MOCK=1 node qa/real-model.js` | Harness self-test: every scenario below with the fake model. Content checks fail by design; any "harness error" means a selector or flow broke. | 0 (fake model) |
| `node qa/real-model.js` | Mise's actual judgment on 18 awkward scenarios (P1–P8 planning: vegan asking for katsu, nut allergy, microwave-only, prompt injection…; C1–C10 recipe changes and talking to Mise). `SCENARIO=C1,C5` runs some. Read the transcripts, not just the pass marks. | ~100–150 |
| `node qa/creativity.js` | Variety and creativity over several weeks for three cooks, plus cold draws, scored by a judge model against a quota. `WEEKS`, `COLD` tune it. | ~20 (15 weeks + judge) |
| `node qa/adventure.js` | Whether the adventure setting (1–5) changes the food: five cooks plan `WEEKS` weeks each, a judge rates the dishes blind. | ~20 (15 weeks + judge) |
| `node qa/a11y.js` | axe-core WCAG 2.1 AA on every page at phone and desktop size, plus keyboard basics. Needs `npm i --no-save axe-core`. | ~2 |

The real-model, creativity and adventure runs need `GEMINI_API_KEY` in the
environment (the judge reads it directly) and a server running with that
provider.

## How it fits together

- **AI calls are server-side** (`app/api/chat/route.js`), through one of
  `lib/providers/{anthropic,gemini,openai,mistral}.js`, which all take the same
  arguments and return plain text. A person can also use their own OpenAI or
  Anthropic key from My Kitchen; it stays in their browser and is never stored.
- **Storage** is Postgres, per account (`app/api/storage/route.js`).
- **The flow:** landing → `/start` (intro → kitchen setup → tour → create
  account) → `/pricing` (paywall) → `/app`. Before sign-up, setup is kept on the
  device and copied to the account by `/auth/finish`. `/app` checks the session
  and subscription on the server before sending the app's code.
- **Usage events** for `/admin` stay in our own database (`lib/events.js`);
  only allowlisted names and a few short props are stored.
- **Legal:** `/privacy`, `/terms`, `/refunds`, `/cookies`. Signup records age
  and terms consent with `POLICY_VERSION` (`lib/business.js`; bump it when a
  policy changes materially). People can export (`GET /api/account/export`)
  and delete (`POST /api/account/delete`) their data. Third parties are listed
  in `docs/THIRD_PARTIES.md`.

## Updating the cooking doctrine

`lib/doctrine.json` is generated from the skill
(`weekly-cooking-collaborator/SKILL.md`, in its own repo) by its
`scripts/build_doctrine.py`; never hand-edit it:

```
python3 build_doctrine.py <path-to-artifact.jsx> <path-to-this-repo>/lib/doctrine.json
```

It holds named slices (`core`, `groceries`, `flavor`); `buildDoctrine(names)`
in `lib/doctrine.js` sends each call only the slices it asks for (`docSlices`
at each call site in `components/MiseApp.jsx`). A new slice has to be asked
for by name.

## iOS

`ios/` is a Capacitor WebView around the deployed site; see `ios/README.md`.
Cook mode's audio plays through a "playback" audio session so the silent
switch doesn't mute it (set in `ios/App/App/AppDelegate.swift`).
