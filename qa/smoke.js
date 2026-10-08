// Smoke test: one fast pass through the whole product as a new person would
// take it, with the fake model standing in for /api/chat. No AI quota spent;
// about a minute. CI runs this on every push.
//
//   BASE_URL=http://localhost:3000 node qa/smoke.js
//
// Guest onboarding at /start (intro, kitchen setup, tour) → create an account
// (strong password + confirm) → paywall → redeem VIP26 → plan a week → pick
// dishes and shop → open a recipe → cook mode → ask Mise one question →
// the new-week sheet. Each screen has to render, and the run fails on any
// uncaught page error or any 5xx from our own API. On failure it saves a
// screenshot and the page text to $QA_OUT (default qa/out).
const fs = require("fs");
const path = require("path");
const h = require("./harness");
const fake = require("./fake-model");

const OUT = process.env.QA_OUT || path.join(__dirname, "out");
const PASSWORD = "Kitchen-smoke-2026";

const steps = [];
let page;

/* One named step: runs fn, records how long it took, and stops the run at the
   first failure (later screens depend on earlier ones). */
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    steps.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`ok   ${name} (${Date.now() - t0}ms)`);
  } catch (e) {
    steps.push({ name, ok: false, ms: Date.now() - t0, error: e.message });
    console.log(`FAIL ${name}: ${e.message}`);
    throw e;
  }
}

function expect(cond, msg) { if (!cond) throw new Error(msg); }

/* Fails the current step if the page has thrown or our API answered 5xx. */
function noErrors(p) {
  expect(!p.errs.length, `page error: ${p.errs.join(" / ")}`);
  expect(!p.bad.length, `server error: ${p.bad.join(" / ")}`);
}

async function visible(p, locator, what, timeout = 15000) {
  await locator.first().waitFor({ state: "visible", timeout }).catch(() => { throw new Error(`${what} never appeared`); });
}

/* The primary forward button on whichever onboarding screen is showing. */
const FORWARD = /^(Next|Set up my kitchen|Continue|Let's go|Got it|Make my account|Save my kitchen|Show me|Start)/;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await h.launch();
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
  const p = (page = await ctx.newPage());
  p.errs = [];
  p.bad = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 500 && new URL(r.url()).pathname.startsWith("/api/")) p.bad.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  p.on("dialog", (d) => d.accept()); // "Draw a new week?" confirms
  await fake.install(p);

  try {
    await step("health check answers", async () => {
      const r = await p.request.get(h.B + "/api/health");
      const j = await r.json();
      expect(j.checks?.database?.ok, `database not ok: ${JSON.stringify(j.checks?.database)}`);
      expect(j.checks?.schema?.ok, `schema not ok: ${JSON.stringify(j.checks?.schema)}`);
    });

    await step("landing page renders", async () => {
      await p.goto(h.B + "/");
      await visible(p, p.locator("h1"), "landing heading");
      noErrors(p);
    });

    await step("guest onboarding: intro and cookie banner", async () => {
      await p.goto(h.B + "/start");
      await visible(p, p.getByRole("button", { name: "Essential only" }), "cookie banner");
      await p.getByRole("button", { name: "Essential only" }).click();
      await visible(p, p.getByText("First, tell me about your kitchen."), "intro");
      noErrors(p);
    });

    await step("kitchen setup (7 steps) and tour", async () => {
      const seen = new Set();
      let tour = 0;
      for (let i = 0; i < 30; i++) {
        if (await p.locator("#su-email").isVisible().catch(() => false)) break;
        // allInnerTexts doesn't wait, so the tour screens (no step counter) stay fast.
        for (const k of await p.locator("text=/STEP \\d OF 7/i").allInnerTexts()) seen.add(k.toUpperCase());
        if (await p.getByRole("button", { name: "Skip the tour" }).isVisible().catch(() => false)) tour++;
        const fwd = p.getByRole("button", { name: FORWARD }).last();
        await visible(p, fwd, `a forward button (after ${[...seen].join(", ") || "intro"})`, 8000);
        await fwd.click();
        await p.waitForTimeout(350);
      }
      expect(seen.size === 7, `saw ${seen.size} of 7 setup steps`);
      expect(tour >= 1, "the app tour never showed");
      await visible(p, p.locator("#su-email"), "create-account screen");
      noErrors(p);
    });

    await step("create account (strong password + confirm)", async () => {
      const boxes = p.locator(".acct input[type=checkbox]");
      expect((await boxes.count()) >= 2, "age and terms checkboxes missing");
      for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
      const email = `smoke${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;
      await p.locator("#su-email").fill(email);
      await p.locator("#su-new").fill(PASSWORD);
      await p.locator("#su-confirm").fill(PASSWORD + "x");
      const create = p.getByRole("button", { name: "Create my account" });
      expect(await create.isDisabled(), "Create my account enabled with mismatched passwords");
      await p.locator("#su-confirm").fill(PASSWORD);
      expect(await create.isEnabled(), "Create my account still disabled with matching strong passwords");
      await create.click();
      await p.waitForURL(/\/pricing/, { timeout: 20000 });
      noErrors(p);
    });

    await step("paywall renders and VIP26 unlocks the app", async () => {
      await visible(p, p.getByText("Have a code?"), "paywall code link");
      await p.getByText("Have a code?").click();
      await p.locator("#code").fill("VIP26");
      await p.getByRole("button", { name: "Apply" }).click();
      await p.waitForURL(/\/app/, { timeout: 20000 });
      noErrors(p);
    });

    await step("plan a week", async () => {
      // Setup was finished as a guest, so the app should open ready to plan.
      await visible(p, p.getByRole("button", { name: /Start this week|Show me this week|Show me some ideas/ }), "plan-a-week start");
      await h.startWeek(p);
      const d = await h.dishes(p);
      expect(d.length >= 3, `${d.length} dish cards`);
      noErrors(p);
    });

    await step("pick dishes and shop", async () => {
      await h.pickAndShop(p, 3);
      const items = await h.shoppingItems(p);
      expect(items.length >= 3, `${items.length} shopping items`);
      noErrors(p);
    });

    await step("open a recipe", async () => {
      const r = await h.openRecipe(p, /Charred Cabbage|Garlic Chickpea|Crispy Rice/);
      expect(r && r.steps.length >= 2, `recipe: ${JSON.stringify(r)}`);
      noErrors(p);
    });

    await step("cook mode", async () => {
      await p.getByRole("button", { name: "Start cooking" }).first().click();
      await visible(p, p.locator(".cook__exit"), "cook mode");
      // The mise en place checklist comes first; move on to the steps.
      for (let i = 0; i < 3 && !(await p.locator(".cooknav__mise").isVisible().catch(() => false)); i++) {
        await p.locator(".cook .btn, .cook button.btn").last().click();
        await p.waitForTimeout(400);
      }
      await visible(p, p.locator(".cooknav__mise"), "cook-mode steps");
      noErrors(p);
    });

    await step("ask Mise one question", async () => {
      const reply = await h.askMise(p, "How do I know the pan is hot enough?");
      expect(/Sure thing/.test(reply), `reply was "${reply}"`);
      expect(fake.calls.some((c) => c.kind === "ask"), "no ask call reached the model");
      noErrors(p);
    });

    await step("new-week sheet", async () => {
      await p.locator(".cook__exit").click();
      await p.waitForTimeout(500);
      await p.getByRole("button", { name: "New week" }).click();
      await visible(p, p.getByRole("dialog", { name: "Start a new week?" }), "new-week sheet");
      await p.getByRole("button", { name: "Keep this week" }).click();
      noErrors(p);
    });
  } catch (_) {
    await page.screenshot({ path: path.join(OUT, "smoke-failure.png"), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(OUT, "smoke-failure.txt"), `${page.url()}\n\n${await page.innerText("body").catch(() => "")}`);
  }

  const failed = steps.filter((s) => !s.ok);
  const calls = fake.calls.reduce((m, c) => ((m[c.kind] = (m[c.kind] || 0) + 1), m), {});
  fs.writeFileSync(path.join(OUT, "smoke.json"), JSON.stringify({ steps, modelCalls: calls }, null, 2));
  console.log(`\n${steps.length - failed.length}/${steps.length} steps passed; fake model calls: ${JSON.stringify(calls)}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
