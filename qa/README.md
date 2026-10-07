# QA scripts

Browser-driven tests of the real user experience. Nothing here ships with the app.

## Real-model run (Mise's actual judgment)

Needs `GEMINI_API_KEY` set in the environment (for a Claude Code cloud
environment: environment settings → environment variables; new sessions pick
it up).

```
qa/setup.sh                                  # Postgres, schema, build, app on :3000 (AI_PROVIDER=gemini, paywall off)
npm i --no-save playwright-core              # browser driver; Chromium is already in the container
node qa/real-model.js                        # all scenarios, ~15–25 min on the free tier
SCENARIO=C1,C5 node qa/real-model.js         # just some
```

Output: `qa/out/report.md` (PASS/FAIL per check) and `qa/out/<id>.json` with
every prompt and raw model answer, plus a screenshot per scenario. The
mechanical checks are a floor, not a verdict: read the transcripts for tone,
whether the options offered are genuinely different, and whether advice is
actually safe.

Scenarios: `P1`–`P8` plan a week against awkward profiles (vegan asking for
katsu, nut allergy asking for peanut pad thai, microwave-only, zero heat,
1→8 headcount, prompt injection, Spanish + emoji, 20-minute "push me").
`C1`–`C10` correct recipes and talk to Mise (no buns, make it vegan, scale to
8, remove the defining ingredient, food safety at the stove, list edits by
chat, dairy for a dairy-free profile, off-topic/prompt-dump attempts, five
edits in a row, contradictory instructions).

## Smoke test (no key, ~30 s)

```
BASE_URL=http://localhost:3000 node qa/smoke.js
```

One new person's whole path with the fake model: onboarding at `/start`,
sign-up, paywall and `VIP26`, a planned week, shopping, a recipe, cook mode,
one question to Mise, the new-week sheet. Fails on any page error or API 5xx.
CI runs this on every push.

## Harness self-test (no key)

```
MOCK=1 node qa/real-model.js
```

Swaps `/api/chat` for `fake-model.js` in the browser. Content checks fail by
design (the fake answers are canned); any "harness error" means a selector or
flow broke.

## Recipe quality

```
GEMINI_API_KEY=... BASE_URL=http://localhost:3000 node qa/recipes.js
REUSE=qa/out/recipes.json node qa/recipes.js   # same weeks, rewrite recipes only (3 calls a cook)
```

Five cooks (small stovetop+microwave kitchen, dairy-free family, adventurous
vegetarian, headcount 1/8/3 by night, no heat) plan and shop through the app;
the recipes it writes are checked mechanically (unlisted/unbought ingredients,
time, servings, °F, doneness, equipment, restrictions, quantities, step count)
and judged by Gemma for clarity, correctness and flavor. Output: recipes.md/json.
