// Browser harness for driving Mise like a person would. Uses the Chromium that
// ships in Claude Code cloud containers; install the driver once with
//   npm i --no-save playwright-core
const { chromium } = require("playwright-core");

const B = process.env.BASE_URL || "http://localhost:3000";
const EXEC = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

const launch = () => chromium.launch({ executablePath: EXEC, headless: true, args: ["--no-sandbox"] });

/* A fresh account with an exact profile written straight to storage, so a
   scenario controls restrictions/equipment/heat precisely instead of clicking
   through seven setup steps. Every /api/chat exchange is recorded on p.log. */
async function newUser(browser, profile = {}) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.ctx = ctx;
  p.log = [];
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  p.on("response", async (r) => {
    if (!r.url().endsWith("/api/chat")) return;
    let req = {};
    try { req = r.request().postDataJSON(); } catch (_) {}
    let text = "";
    try { text = (await r.json()).text ?? JSON.stringify(await r.json()); } catch (_) { text = `(HTTP ${r.status()})`; }
    p.log.push({ status: r.status(), prompt: req?.messages?.at(-1)?.content || "", tier: req?.tier, answer: text });
  });
  const email = `qa${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;
  await p.request.post(B + "/api/auth/signup", { data: { email, password: "password123" } });
  const base = {
    people: 1, consistent: true, headcount: {}, nights: ["Tue", "Thu", "Sat"], time: 45, spice: 2, adventure: 3,
    restrictions: [], restrictionsNote: "", dislikes: "", healthConscious: false,
    equipment: ["Oven", "Stovetop", "Cast iron pan", "Sheet pans", "Rice cooker"], smokeAlarm: true,
  };
  const value = JSON.stringify({ profile: { ...base, ...profile }, favorites: [], setupDone: true, savedAt: new Date().toISOString(), style: "modern" });
  await p.request.post(B + "/api/storage", { data: { key: "mise:profile-v3", value } });
  await p.goto(B + "/app");
  await p.waitForTimeout(1500);
  return p;
}

const text = async (p) => (await p.innerText("body")).replace(/\n+/g, " | ");
const alertText = async (p) => (await p.$$eval("[role=alert]", (els) => els.map((e) => e.innerText).join(" / ")).catch(() => ""));
const tab = async (p, name) => { await p.locator(".tabbar__b", { hasText: name }).click({ force: true }); await p.waitForTimeout(500); };

/* Waits until the app is idle: no top progress bar and no visible skeleton, up
   to `ms`. Real model calls take 5–50s. */
async function idle(p, ms = 90000) {
  const t0 = Date.now();
  await p.waitForTimeout(800);
  while (Date.now() - t0 < ms) {
    const busy = await p.$(".topbar, .ph, .skel, [aria-busy=true]");
    const working = /Working…|Writing |Putting some ideas|Checking package|Thinking/.test(await p.innerText("body"));
    if (!busy && !working) return true;
    await p.waitForTimeout(700);
  }
  return false;
}

async function startWeek(p, { fridge = "", cravings = "", request = "" } = {}) {
  const start = p.getByRole("button", { name: /Start this week|Show me this week/ }).first();
  if (await start.count()) { await start.click(); await p.waitForTimeout(500); }
  if (fridge) await p.locator("#fr").fill(fridge);
  if (cravings) await p.locator("#cr").fill(cravings);
  if (request) await p.locator("#rq").fill(request);
  await p.getByRole("button", { name: "Show me some ideas", exact: true }).click();
  await idle(p);
}

/* The candidate cards on Brainstorm: title, blurb, why, meta line. */
const dishes = (p) => p.$$eval("article.dish", (els) => els.map((e) => ({
  title: e.querySelector("h3")?.innerText, blurb: e.querySelector(".dish__b")?.innerText,
  why: e.querySelector(".dish__why")?.innerText, meta: e.querySelector(".dish__meta")?.innerText,
})));

async function pickAndShop(p, n = 3) {
  const adds = p.getByRole("button", { name: "Add it", exact: true });
  const count = Math.min(n, await adds.count());
  for (let i = 0; i < count; i++) { await adds.first().click(); await p.waitForTimeout(200); }
  await p.locator(".wiz button").last().click(); await p.waitForTimeout(800);   // Plan my week
  await p.locator(".wiz button").last().click(); await idle(p, 120000);         // Make my shopping list
}

const shoppingItems = (p) => p.$$eval(".row2__face", (els) => els.map((e) => e.getAttribute("aria-label").replace(/\. Tap to edit\.$/, "")));

async function openRecipe(p, titleRe) {
  await tab(p, "Cooking");
  await p.getByRole("button", { name: titleRe }).first().click();
  await idle(p, 120000);
  return p.$eval(".card", () => {
    const card = [...document.querySelectorAll(".card")].find((c) => c.querySelector(".hsteps"));
    if (!card) return null;
    return {
      title: card.querySelector("h2")?.innerText,
      meta: card.querySelector(".lead")?.innerText,
      items: [...card.querySelectorAll(".comp__l2 li span")].map((e) => e.innerText),
      steps: [...card.querySelectorAll(".hstep__do")].map((e) => e.innerText),
      notes: [...card.querySelectorAll(".note, .stale, .learn")].map((e) => e.innerText),
    };
  });
}

/* Ask for a recipe change from the Cooking page. Returns Mise's reaction and
   the routes she offers ({label, what, cost, best}). */
async function proposeChange(p, instruction) {
  const fold = p.getByRole("button", { name: /Want to change something/ });
  if (!(await p.locator(".rchat, .opts").count()) && (await fold.count())) { await fold.click(); await p.waitForTimeout(300); }
  const box = p.getByPlaceholder(/./).last();
  await box.fill(instruction); await box.press("Enter");
  await idle(p);
  const say = await p.$$eval(".rchat .bub--mise p", (els) => els.map((e) => e.innerText).at(-1) || "");
  const options = await p.$$eval(".opts .opt", (els) => els.map((e) => ({
    label: e.querySelector(".opt__lab")?.innerText, what: e.querySelector(".opt__what")?.innerText,
    cost: e.querySelector(".opt__cost")?.innerText, best: e.classList.contains("opt--best"),
  })));
  return { say, options };
}

/* Pick one of the offered routes (by index, default the one she'd pick). */
async function pickOption(p, index = null) {
  const opts = p.locator(".opts .opt");
  const best = p.locator(".opts .opt--best");
  await ((index == null && (await best.count())) ? best.first() : opts.nth(index ?? 0)).click();
  await idle(p, 120000);
  return p.$$eval(".rchat .bub--mise p", (els) => els.slice(-2).map((e) => e.innerText));
}

/* Ask Mise and return her latest reply. Two different boxes: the sheet (#mq)
   everywhere, and the cook-mode bubble (#cq) at the stove. */
async function askMise(p, question) {
  const inCook = (await p.locator(".cbubble, #cq").count()) > 0;
  const input = inCook ? "#cq" : "#mq";
  if (!(await p.locator(input).count())) {
    await p.locator(inCook ? ".cbubble" : ".fab").first().click({ force: true });
    await p.waitForTimeout(500);
  }
  await p.locator(input).fill(question); await p.locator(input).press("Enter");
  await idle(p);
  await p.waitForFunction((q) => !document.querySelector(".bub--wait"), null, { timeout: 90000 }).catch(() => {});
  return inCook
    ? p.$eval(".cask__say", (e) => e.innerText).catch(() => "")
    : p.$$eval(".sheet .bub--mise p", (els) => els.map((e) => e.innerText).at(-1) || "");
}

const closeMise = async (p) => { const x = p.locator(".sheet__x"); if (await x.count()) await x.click(); };

module.exports = { B, launch, newUser, text, alertText, tab, idle, startWeek, dishes, pickAndShop, shoppingItems, openRecipe, proposeChange, pickOption, askMise, closeMise };
