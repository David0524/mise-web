# Third parties and SDKs

Audited 2026-10-06. Keep this in step with the processor table in
`app/privacy/page.js` and the table in `app/cookies/page.js`.

## Services that receive user data

| Service | Used for | What it receives | When |
|---|---|---|---|
| Hosting (your host) | Serving the site and API | Every request, incl. IP address | Always |
| Postgres (your DB provider) | Accounts, profiles, plans, recipes | Everything in `prisma/schema.sql` | Always |
| Stripe | Checkout, billing portal, webhooks | Email, card details (entered on stripe.com), subscription | Only when subscribing / managing billing |
| Google Gemini API | Plans, recipes, answers; TTS fallback | Prompt content: profile, plan, the person's question. Never email or payment info | Default AI provider |
| OpenAI | TTS (if `OPENAI_API_KEY` set); chat with the person's own key | Text to speak; prompt content | Only if configured / BYOK |
| Anthropic | Chat with the person's own key | Prompt content | Only BYOK |
| Google Sign-In | "Continue with Google" | OAuth redirect; we receive name/email/Google id | Only if the person uses it |
| Sign in with Apple | "Continue with Apple" | OAuth redirect; we receive email (may be a relay address) and Apple id | Only if the person uses it |
| Twilio Verify | Phone sign-in codes | Phone number | Only if the person uses phone sign-in |
| Resend | Password reset email | Email address, reset link | Only when someone asks for a reset |
| Browser / OS speech recognition | Dictation (mic button) | Audio, processed by Apple/Google under their terms | Only when the mic is tapped |

**Before launch:** use a paid Gemini tier. On the free tier Google may use
prompts and responses to improve its products, which the privacy policy does
not allow for.

## Things that are deliberately NOT here

- No analytics (no Google Analytics, Vercel Analytics, PostHog, Segment, Sentry…)
- No advertising or tracking pixels
- No third-party fonts at runtime: Nunito and Caveat are self-hosted in `public/fonts`
- No third-party scripts in the page at all; Stripe is a redirect, not an embedded SDK

If you add any of these, update the privacy and cookie policies first, and gate
anything non-essential behind `hasOptionalConsent()` from `components/CookieBanner.jsx`.

## npm dependencies (runtime)

| Package | Why | Talks to the network? |
|---|---|---|
| next, react, react-dom | Framework | No |
| pg | Postgres driver | Your DB only |
| bcryptjs | Password hashing | No |
| jose | Session JWT signing | No |
| stripe | Stripe server SDK | api.stripe.com only |
| @capacitor/ios | Native iOS shell | No |

Dev-only: `@capacitor/cli`, `@capacitor/core`. QA scripts additionally use
`playwright` and `axe-core`, installed with `--no-save` and never shipped.
