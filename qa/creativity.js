// Creativity and variety eval: does Mise keep weeks interesting, distinct and
// unrepetitive, without breaking anyone's constraints?
//
// Each test cook plans WEEKS weeks in a row through the real app; after each
// week the first three dishes are saved to their history, exactly as picking
// and shopping would. A few cold draws of one profile check that two strangers
// with the same setup don't get the same week. A separate model judges each
// week. Results are scored against a quota (pass marks) below.
//
//   GEMINI_API_KEY=... BASE_URL=http://localhost:3000 node qa/creativity.js
//   (app running with AI_PROVIDER=gemini; the key is only read from the env)
//
// Writes qa/out/creativity.md and creativity.json (or $QA_OUT).
const fs = require("fs");
const path = require("path");
const h = require("./harness");

const OUT = process.env.QA_OUT || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const WEEKS = Number(process.env.WEEKS || 4);
const COLD = Number(process.env.COLD || 3);
const JUDGE = process.env.JUDGE_MODEL || "gemini-3.7-flash";
const JUDGE_FALLBACK = process.env.JUDGE_FALLBACK || "gemini-3.5-flash-lite";
const KEY = process.env.GEMINI_API_KEY;

const PROFILES = {
  adventurous: { label: "Adventurous omnivore, 2 people, 4 nights", profile: { people: 2, nights: ["Mon", "Tue", "Thu", "Sat"], adventure: 5, spice: 3, time: 45 } },
  cautious: { label: "Cautious vegetarian, 1 person, 3 nights", profile: { people: 1, nights: ["Tue", "Thu", "Sun"], adventure: 2, spice: 1, time: 30, restrictions: ["Vegetarian"] } },
  family: { label: "Dairy-free family of 4, 5 nights", profile: { people: 4, nights: ["Mon", "Tue", "Wed", "Thu", "Sun"], adventure: 3, spice: 2, time: 45, restrictions: ["Dairy-free"], equipment: ["Oven", "Stovetop", "Sheet pans", "Big pot", "Slow cooker"] } },
};

/* The quota. Each is a pass mark over all weeks (or all cooks). */
const QUOTA = [
  ["formats", "Every dish in a week uses a different cooking format", "100% of weeks"],
  ["cuisines", "Every dish in a week from a different cuisine (judge)", "≥ 90% of weeks"],
  ["cliches", "Cliché dishes", "≤ 1 per week"],
  ["seedUsed", "Draw used: pantry ingredient and vegetable each in ≥ 2 dishes", "≥ 90% of weeks"],
  ["titles", "No monotony: pantry in ≤ 1 title, vegetable in ≤ 2, no shared lead word, no format filler (\"Skillet Plate\")", "≥ 90% of weeks"],
  ["repeats", "Repeated / near-duplicate dishes across a cook's weeks", "0"],
  ["proteins", "Different main proteins over a cook's weeks", `≥ ${Math.min(3, WEEKS)}`],
  ["creativity", "Creativity score (judge, 1–5)", "avg ≥ 4.0, no week < 3"],
  ["cold", "Shared dishes across cold draws of one profile", "≤ 1"],
  ["constraints", "Restriction violations (judge)", "0"],
];

const STOP = new Set(["with", "and", "the", "a", "of", "in", "on", "over", "style", "dish", "bowl", "bowls", "plate", "salad", "roasted", "seared", "crispy", "quick", "easy", "fresh", "warm", "spiced", "sauce", "glazed", "braised", "toasted"]);
const words = (t) => String(t || "").toLowerCase().replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
/* Near-duplicate: two titles sharing most of their meaningful words. */
function nearDup(a, b) {
  const A = new Set(words(a)), B = new Set(words(b));
  if (!A.size || !B.size) return false;
  const shared = [...A].filter((w) => B.has(w)).length;
  return shared / Math.min(A.size, B.size) >= 0.67;
}
const mentions = (dish, term) => {
  const t = String(term || "").toLowerCase().split(/\s+(?:and|in)\s+/)[0].replace(/s$/, "");
  const txt = `${dish.title} ${dish.blurb} ${dish.why}`.toLowerCase();
  return t && txt.includes(t.split(" ").slice(-1)[0]);
};

async function gemini(model, prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { ...(model.startsWith("gemma") ? {} : { responseMimeType: "application/json" }), maxOutputTokens: 12000 } }),
  });
  if (!r.ok) { const e = new Error(`judge ${r.status}`); e.status = r.status; throw e; }
  const j = await r.json();
  const txt = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  return JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
}

/* One call per cook, all weeks together: the judge sees them side by side
   (which is how variety is felt) and a run fits under free-tier daily caps. */
async function judgeCook(profile, weeks) {
  const prompt = `You are a demanding food editor judging a home-cooking app's weekly dinner suggestions for creativity and variety.

The cook: ${JSON.stringify(profile)}
(adventure 1-5: 1 = familiar food, 5 = push me; spice 0-4)

${weeks.map((w, i) => `WEEK ${i + 1}. Shared ingredients for the week (the app deliberately puts each in only 2-3 dishes so the week doesn't become one protein in five sauces; don't penalise dishes that leave them out): ${JSON.stringify({ pantry: w.seed.pantry, vegetable: w.seed.vegetable, protein: w.seed.protein })}
Dishes: ${JSON.stringify(w.dishes.map((d) => ({ title: d.title, blurb: d.blurb, format: d.format })))}`).join("\n\n")}

Judge each week strictly. Return JSON: {"weeks":[one object per week, in order:
{"cuisines":["the cuisine or flavour world of each dish, same order"],
 "allDistinctCuisines":true or false (no two dishes share a flavour world),
 "cliches":["titles that are generic, default dishes any recipe site would give — empty if none"],
 "violations":["any dish that breaks the cook's restrictions or heat ceiling, or is unsafe to eat (raw pork, raw chicken) — empty if none. Not format or style issues"],
 "creativity":1-5, judged for THIS cook's adventurousness (5 = this cook would be genuinely excited: each dish has a real idea and the week feels like several different dinners; 3 = competent but predictable; 1 = generic). For a cautious cook, familiar dishes with a smart fresh twist can earn a 5; for an adventurous one, the obvious version of a cuisine cannot,
 "fitsCook":1-5 (right ambition level for THIS cook's adventurousness and time),
 "best":"the most exciting dish", "weakest":"the dullest dish", "why":"one sentence on what would make this week more creative"}]}`;
  for (const model of [JUDGE, JUDGE_FALLBACK]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const out = await gemini(model, prompt); return (out.weeks || []).map((x) => ({ model, ...x })); }
      catch (e) {
        if (e.status === 503 || e.status === 500) { await new Promise((r) => setTimeout(r, 8000 * (attempt + 1))); continue; }
        if (e.status === 429 || e.status === 404 || e instanceof SyntaxError) break;
        throw e;
      }
    }
  }
  throw new Error("judge unavailable");
}

async function readWeek(p) {
  // The app saves the week ~1s after it changes; wait for the saved copy.
  let d = {};
  for (let i = 0; i < 20; i++) {
    const r = await p.request.get(h.B + "/api/storage?key=mise:week-v1").then((x) => x.json()).catch(() => ({}));
    d = r?.value ? JSON.parse(r.value) : {};
    if ((d.candidates || []).length) break;
    await p.waitForTimeout(700);
  }
  return { seed: d.weekSeed || {}, ecosystem: d.ecosystem || {}, dishes: (d.candidates || []).map((c) => ({ title: c.title, blurb: c.blurb, why: c.why, format: c.format, cuisine: c.cuisine, basedOn: c.basedOn })) };
}

/* Archive the week the way picking three and shopping would, then clear it. */
async function archiveAndReset(p, week, i, history) {
  history.unshift({
    id: `qa-week-${i}-${Date.now()}`, startedAt: new Date(Date.now() - (WEEKS - i) * 7 * 864e5).toISOString(),
    seed: week.seed, dishes: week.dishes.slice(0, 3).map((d) => ({ title: d.title, blurb: d.blurb })),
  });
  await p.request.post(h.B + "/api/storage", { data: { key: "mise:history-v1", value: JSON.stringify(history) } });
  await p.request.post(h.B + "/api/storage", { data: { key: "mise:week-v1", value: JSON.stringify({}) } });
}

async function planWeek(p) {
  await p.goto(h.B + "/app"); await p.waitForTimeout(1500);
  await h.startWeek(p);
  return readWeek(p);
}

const FILLER = /\b(sheet-pan roast|handheld|skillet plate|grain bowl|legume bowl|parcels?|steam-cooked|rice-cooker bowl)\b/i;
const inTitle = (title, term) => {
  const t = String(term || "").toLowerCase().split(/\s+(?:and|in|or)\s+/)[0].replace(/s$/, "").split(" ").slice(-1)[0];
  return !!t && String(title).toLowerCase().includes(t);
};
function titleProblems(w) {
  const titles = w.dishes.map((d) => d.title || "");
  const out = [];
  const pt = titles.filter((t) => inTitle(t, w.seed.pantry)).length;
  const vt = titles.filter((t) => inTitle(t, w.seed.vegetable)).length;
  if (pt > 1) out.push(`${w.seed.pantry} in ${pt} titles`);
  if (vt > 2) out.push(`${w.seed.vegetable} in ${vt} titles`);
  const leads = titles.map((t) => t.toLowerCase().split(/[\s-]+/)[0]);
  if (new Set(leads).size < leads.length) out.push("titles share a lead word");
  const filler = titles.filter((t) => FILLER.test(t));
  if (filler.length) out.push(`format filler: ${filler.join("; ")}`);
  return out;
}

function scoreWeek(w) {
  const n = w.dishes.length;
  const formats = new Set(w.dishes.map((d) => d.format).filter(Boolean));
  const pantryUses = w.dishes.filter((d) => mentions(d, w.seed.pantry)).length;
  const vegUses = w.dishes.filter((d) => mentions(d, w.seed.vegetable)).length;
  return {
    n,
    formatsOk: n > 0 && formats.size === n,
    cuisinesOk: !!w.judge?.allDistinctCuisines,
    cliches: (w.judge?.cliches || []).length,
    seedOk: pantryUses >= 2 && vegUses >= 2,
    titlesOk: titleProblems(w).length === 0,
    titleProblems: titleProblems(w),
    pantryUses, vegUses,
    creativity: Number(w.judge?.creativity) || 0,
    fitsCook: Number(w.judge?.fitsCook) || 0,
    violations: (w.judge?.violations || []).length,
  };
}

(async () => {
  if (!KEY) { console.error("Set GEMINI_API_KEY for the judge."); process.exit(1); }
  let result;
  if (process.env.REJUDGE) {
    // Re-score a saved run with the current judge, so runs compare fairly.
    result = JSON.parse(fs.readFileSync(process.env.REJUDGE, "utf8"));
    result.rejudged = new Date().toISOString();
    for (const [id, c] of Object.entries(result.cooks)) {
      const v = await judgeCook(PROFILES[id].profile, c.weeks).catch((e) => { console.error(`judge: ${e.message}`); return []; });
      c.weeks.forEach((w, i) => { w.judge = w.dishes.length ? v[i] || {} : {}; w.score = scoreWeek(w); });
      console.log(`${id} creativity: ${c.weeks.map((w) => w.score.creativity).join(", ")}`);
    }
  } else {
  result = { at: new Date().toISOString(), cooks: {}, cold: [] };
  const b = await h.launch();

  for (const [id, cfg] of Object.entries(PROFILES).filter(([k]) => !process.env.ONLY || process.env.ONLY.split(",").includes(k))) {
    const p = await h.newUser(b, cfg.profile);
    const history = [];
    const weeks = [];
    for (let i = 0; i < WEEKS; i++) {
      const w = await planWeek(p).catch((e) => ({ seed: {}, ecosystem: {}, dishes: [], error: e.message.split("\n")[0] }));
      if (!w.dishes.length) console.error(`${id} week ${i + 1}: no dishes (${await h.alertText(p)})`);
      weeks.push(w);
      console.log(`${id} week ${i + 1}: ${w.dishes.map((d) => d.title).join(" | ")}`);
      await archiveAndReset(p, w, i, history);
    }
    const verdicts = await judgeCook(cfg.profile, weeks).catch((e) => { console.error(`judge: ${e.message}`); return []; });
    weeks.forEach((w, i) => { w.judge = w.dishes.length ? verdicts[i] || {} : {}; w.score = scoreWeek(w); });
    console.log(`${id} creativity: ${weeks.map((w) => w.score.creativity).join(", ")}`);
    // Cross-week repeats.
    const all = weeks.flatMap((w, wi) => w.dishes.map((d) => ({ wi, t: d.title })));
    const repeats = [];
    for (let x = 0; x < all.length; x++) for (let y = x + 1; y < all.length; y++) {
      if (all[x].wi !== all[y].wi && nearDup(all[x].t, all[y].t)) repeats.push(`${all[x].t} ≈ ${all[y].t}`);
    }
    const proteins = new Set(weeks.map((w) => String(w.ecosystem.protein || "").toLowerCase().trim()).filter(Boolean));
    result.cooks[id] = { label: cfg.label, weeks, repeats, proteins: [...proteins], pantries: weeks.map((w) => w.seed.pantry) };
    await p.ctx.close();
  }

  // Cold draws: strangers with the same setup.
  for (let i = 0; i < COLD; i++) {
    const p = await h.newUser(b, PROFILES.adventurous.profile);
    const w = await planWeek(p).catch(() => ({ dishes: [] }));
    result.cold.push(w.dishes.map((d) => d.title));
    console.log(`cold ${i + 1}: ${w.dishes.map((d) => d.title).join(" | ")}`);
    await p.ctx.close();
  }
  await b.close();
  }

  // ---- score against the quota
  const weeks = Object.values(result.cooks).flatMap((c) => c.weeks).filter((w) => w.dishes.length);
  const pct = (f) => (weeks.length ? weeks.filter(f).length / weeks.length : 0);
  const creat = weeks.map((w) => w.score.creativity).filter(Boolean);
  const avg = creat.length ? creat.reduce((a, b) => a + b, 0) / creat.length : 0;
  let coldShared = 0;
  for (let x = 0; x < result.cold.length; x++) for (let y = x + 1; y < result.cold.length; y++)
    for (const t of result.cold[x]) if (result.cold[y].some((u) => nearDup(t, u))) coldShared++;
  const repeatsTotal = Object.values(result.cooks).reduce((n, c) => n + c.repeats.length, 0);
  const minProteins = Math.min(...Object.values(result.cooks).map((c) => c.proteins.length));
  const checks = {
    formats: [pct((w) => w.score.formatsOk) === 1, `${Math.round(pct((w) => w.score.formatsOk) * 100)}%`],
    cuisines: [pct((w) => w.score.cuisinesOk) >= 0.9, `${Math.round(pct((w) => w.score.cuisinesOk) * 100)}%`],
    cliches: [weeks.every((w) => w.score.cliches <= 1), `max ${Math.max(0, ...weeks.map((w) => w.score.cliches))}/week, ${weeks.reduce((n, w) => n + w.score.cliches, 0)} total`],
    seedUsed: [pct((w) => w.score.seedOk) >= 0.9, `${Math.round(pct((w) => w.score.seedOk) * 100)}%`],
    titles: [pct((w) => w.score.titlesOk) >= 0.9, `${Math.round(pct((w) => w.score.titlesOk) * 100)}%`],
    repeats: [repeatsTotal === 0, `${repeatsTotal}`],
    proteins: [minProteins >= Math.min(3, WEEKS), `min ${minProteins} per cook`],
    creativity: [avg >= 4 && creat.every((c) => c >= 3), `avg ${avg.toFixed(2)}, min ${Math.min(...creat)}`],
    cold: [coldShared <= 1, `${coldShared}`],
    constraints: [weeks.every((w) => w.score.violations === 0), `${weeks.reduce((n, w) => n + w.score.violations, 0)}`],
  };
  result.checks = checks;
  const passed = Object.values(checks).filter(([ok]) => ok).length;

  const md = [`# Mise creativity & variety — ${result.at}`, "", `**${passed} of ${QUOTA.length} quota lines met** (judge: ${JUDGE})`, "",
    "| | Measure | Pass mark | Result |", "|---|---|---|---|",
    ...QUOTA.map(([k, label, mark]) => `| ${checks[k][0] ? "✅" : "❌"} | ${label} | ${mark} | ${checks[k][1]} |`), ""];
  for (const [id, c] of Object.entries(result.cooks)) {
    md.push(`## ${c.label}`, `Proteins: ${c.proteins.join(", ") || "?"} · Pantry spines: ${c.pantries.join(", ")}`, c.repeats.length ? `Repeats: ${c.repeats.join("; ")}` : "", "");
    c.weeks.forEach((w, i) => {
      md.push(`**Week ${i + 1}** — draw: ${w.seed.pantry} + ${w.seed.vegetable} + ${w.seed.protein || "?"} · creativity ${w.score.creativity}/5 (${w.judge?.model || "?"}) · fits cook ${w.score.fitsCook}/5 · formats ${w.score.formatsOk ? "✓" : "✗"} · cuisines ${w.score.cuisinesOk ? "✓" : "✗"} · seed ${w.score.pantryUses}/${w.score.vegUses}`);
      w.dishes.forEach((d, j) => md.push(`- ${d.title} — *${d.format || "?"}* · asked ${d.cuisine || "?"}${d.basedOn ? ` (${d.basedOn})` : ""} · judge: ${w.judge?.cuisines?.[j] || ""}`));
      if (w.judge?.cliches?.length) md.push(`- Clichés: ${w.judge.cliches.join("; ")}`);
      if (w.judge?.violations?.length) md.push(`- ⚠ Violations: ${w.judge.violations.join("; ")}`);
      if (w.score.titleProblems?.length) md.push(`- Titles: ${w.score.titleProblems.join("; ")}`);
      if (w.judge?.why) md.push(`- Judge: ${w.judge.why}`);
      md.push("");
    });
  }
  md.push("## Cold draws (same profile, no history)", ...result.cold.map((c, i) => `${i + 1}. ${c.join(" · ")}`));
  fs.writeFileSync(path.join(OUT, "creativity.md"), md.join("\n"));
  fs.writeFileSync(path.join(OUT, "creativity.json"), JSON.stringify(result, null, 2));
  console.log(`\n${passed} of ${QUOTA.length} quota lines met`);
  for (const [k, label] of QUOTA) console.log(`${checks[k][0] ? "PASS" : "FAIL"}  ${label}: ${checks[k][1]}`);
})().catch((e) => { console.error(e); process.exit(1); });
