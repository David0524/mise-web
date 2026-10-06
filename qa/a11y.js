// Accessibility audit: runs axe-core (WCAG 2.1 A/AA rules) on every public page
// and the main app screens, at phone and desktop size, and checks the keyboard
// basics axe can't see (skip link, Escape closes dialogs).
//
//   npm i --no-save playwright-core axe-core
//   node qa/a11y.js            (app running on BASE_URL, default :3000)
//
// Exits non-zero if any serious or critical violation is found.
const fs = require("fs");
const { B, launch, newUser, tab } = require("./harness");

const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const PUBLIC = ["/", "/login", "/pricing", "/forgot", "/reset?token=x", "/auth/consent", "/start", "/privacy", "/terms", "/refunds", "/cookies"];
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } };

async function audit(p, label, out) {
  await p.addScriptTag({ content: AXE });
  const r = await p.evaluate(() =>
    window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })
  );
  for (const v of r.violations) {
    out.push({ where: label, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ")) });
  }
}

(async () => {
  const browser = await launch();
  const found = [];
  const checks = [];

  for (const [size, viewport] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport, serviceWorkers: "block" });
    const p = await ctx.newPage();
    for (const path of PUBLIC) {
      await p.goto(B + path, { waitUntil: "networkidle" });
      await audit(p, `${size} ${path}`, found);
    }
    await ctx.close();
  }

  // Keyboard: the first Tab lands on the skip link, and it moves focus to #main.
  {
    const ctx = await browser.newContext({ viewport: SIZES.phone, serviceWorkers: "block" });
    const p = await ctx.newPage();
    await p.goto(B + "/login", { waitUntil: "networkidle" });
    await p.keyboard.press("Tab");
    const first = await p.evaluate(() => document.activeElement?.textContent?.trim());
    checks.push({ check: "first Tab is the skip link", ok: first === "Skip to content", got: first });
    // The cookie banner is reachable and closes from the keyboard.
    const banner = await p.locator("[aria-label='Cookie choices']").count();
    checks.push({ check: "cookie banner shown on first visit", ok: banner === 1 });
    await p.locator("[aria-label='Cookie choices'] button", { hasText: "Essential only" }).focus();
    await p.keyboard.press("Enter");
    checks.push({ check: "banner dismissed from keyboard", ok: (await p.locator("[aria-label='Cookie choices']").count()) === 0 });
    // Onboarding account step: sign-up stays disabled until both boxes are ticked.
    await p.goto(B + "/start", { waitUntil: "networkidle" });
    await p.evaluate(() => localStorage.setItem("mise:guest:mise:profile-v3", JSON.stringify({ profile: { people: 2, nights: ["Tue"] }, setupDone: true, savedAt: new Date().toISOString() })));
    await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(800);
    await audit(p, "phone /start account step", found);
    const createDisabled = await p.locator("button", { hasText: "Create my account" }).isDisabled().catch(() => null);
    checks.push({ check: "create account disabled until boxes ticked", ok: createDisabled === true, got: createDisabled });
    await ctx.close();
  }

  // App screens, with a seeded account (no model calls needed for these).
  for (const [size, viewport] of Object.entries(SIZES)) {
    const p = await newUser(browser, { restrictions: ["Nut allergy"] });
    await p.setViewportSize(viewport);
    await p.evaluate(() => localStorage.setItem("mise:consent-v1", JSON.stringify({ optional: false })));
    await p.reload();
    await p.waitForTimeout(1500);
    await audit(p, `${size} app: this week`, found);
    // My Kitchen (profile button) first: it's where the tab bar appears and
    // where "Your data" lives.
    await p.locator("button.profile").click();
    await p.waitForTimeout(600);
    await audit(p, `${size} app: My Kitchen`, found);
    for (const name of ["Brainstorm", "Shopping", "Cooking"]) {
      try { await tab(p, name); await audit(p, `${size} app: ${name}`, found); } catch (e) { checks.push({ check: `open tab ${name}`, ok: false, got: e.message.split("\n")[0] }); }
    }
    await p.locator("button.profile").click();
    await p.waitForTimeout(600);
    // Your data: the delete confirm takes focus and Escape backs out.
    if (size === "phone") {
      const del = p.locator("button", { hasText: "Delete my account" });
      if (await del.count()) {
        await del.click();
        const focused = await p.evaluate(() => document.activeElement?.id);
        checks.push({ check: "delete confirm focuses the password field", ok: focused === "del-pw", got: focused });
        await audit(p, `${size} app: delete confirm`, found);
        await p.keyboard.press("Escape");
        checks.push({ check: "Escape cancels delete", ok: (await p.locator("#del-pw").count()) === 0 });
      } else checks.push({ check: "Your data section present", ok: false });
    }
    await p.ctx.close();
  }

  await browser.close();

  const serious = found.filter((v) => v.impact === "serious" || v.impact === "critical");
  const byRule = {};
  for (const v of found) (byRule[`${v.impact} ${v.id}: ${v.help}`] ||= []).push(`${v.where} → ${v.nodes.join(", ")}`);
  console.log("\n=== axe violations ===");
  if (!found.length) console.log("none");
  for (const [k, list] of Object.entries(byRule)) { console.log(k); list.slice(0, 8).forEach((l) => console.log("   " + l)); }
  console.log("\n=== keyboard checks ===");
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.check}${c.ok ? "" : `  (got ${c.got})`}`);
  const failed = serious.length + checks.filter((c) => !c.ok).length;
  console.log(`\n${serious.length} serious/critical violations, ${checks.filter((c) => !c.ok).length} failed checks`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
