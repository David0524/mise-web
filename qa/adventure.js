// Adventure-level eval: does the "how adventurous are you" setting actually
// change the food?
//
// Five cooks identical in every way except adventure (1-5) each plan WEEKS
// weeks through the real app. A judge then rates every dish 1-5 for how
// adventurous it is WITHOUT being told anyone's setting, with all the weeks
// shuffled together. If the setting works, the blind ratings climb with the
// level and land close to it.
//
//   GEMINI_API_KEY=... BASE_URL=http://localhost:3000 [JUDGE_RUNS=3] node qa/adventure.js
//   (the key is only for the judge, read from the env)
//
// Writes adventure.md and adventure.json to $QA_OUT (default qa/out).
const fs = require("fs");
const path = require("path");
const h = require("./harness");

const OUT = process.env.QA_OUT || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const WEEKS = Number(process.env.WEEKS || 3);
const LEVELS = (process.env.LEVELS || "1,2,3,4,5").split(",").map(Number);
const JUDGE = process.env.JUDGE_MODEL || "gemma-4-31b-it";
const JUDGE_FALLBACK = process.env.JUDGE_FALLBACK || "gemma-4-26b-a4b-it";
const KEY = process.env.GEMINI_API_KEY;
const BASE = { people: 2, nights: ["Mon", "Tue", "Thu", "Sat"], spice: 2, time: 45 };

/* The quota. */
const QUOTA = [
  ["order", "Blind rating rises with every level (1 < 2 < 3 < 4 < 5)", "all 4 steps"],
  ["accuracy", "Blind rating close to the level", "every level within 0.75"],
  ["safe", "Level 1-2 weeks: dishes rated 4+ (too adventurous)", "0"],
  ["bold", "Level 5 weeks: dishes rated 4+", "≥ 80%"],
];

const RUBRIC = `1 = food most home cooks already make (spaghetti and meatballs, chicken stir-fry, beef tacos, roast chicken)
2 = a familiar dish with one twist (miso-butter salmon, harissa roast chicken, pesto made with kale)
3 = a dish people know of but rarely cook at home (shakshuka, bibimbap, chicken tikka masala, pad see ew)
4 = a regional dish most people haven't cooked or eaten (Georgian chakhokhbili, Sri Lankan devilled prawns, Persian kuku)
5 = unfamiliar techniques or ingredients a curious cook would have to seek out (doro wat with homemade berbere, mole from toasted dried chiles, Sichuan fish-fragrant eggplant)`;

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

/* Every dish from every week, shuffled, no levels shown. */
async function blindJudge(dishes) {
  const prompt = `Rate how adventurous each home-cooking dinner idea is for an ordinary American home cook, 1 to 5:
${RUBRIC}

Judge the dish itself (how unfamiliar its dish, ingredients and techniques are), not how well it's written.
Dishes:
${dishes.map((d, i) => `${i}. ${d.title} — ${d.blurb || ""}`).join("\n")}

Return JSON: {"ratings":[{"i":0,"score":1-5}, ... one per dish]}`;
  for (const model of [JUDGE, JUDGE_FALLBACK]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await gemini(model, prompt);
        const map = new Map((out.ratings || []).map((r) => [Number(r.i), Number(r.score)]));
        return { model, scores: dishes.map((_, i) => map.get(i) || null) };
      } catch (e) {
        if (e.status === 503 || e.status === 500) { await new Promise((r) => setTimeout(r, 8000 * (attempt + 1))); continue; }
        if (e.status === 429 || e.status === 404 || e instanceof SyntaxError) break;
        throw e;
      }
    }
  }
  throw new Error("judge unavailable");
}

async function readWeek(p) {
  let d = {};
  for (let i = 0; i < 20; i++) {
    const r = await p.request.get(h.B + "/api/storage?key=mise:week-v1").then((x) => x.json()).catch(() => ({}));
    d = r?.value ? JSON.parse(r.value) : {};
    if ((d.candidates || []).length) break;
    await p.waitForTimeout(700);
  }
  return { seed: d.weekSeed || {}, dishes: (d.candidates || []).map((c) => ({ title: c.title, blurb: c.blurb, cuisine: c.cuisine })) };
}

async function archiveAndReset(p, week, i, history) {
  history.unshift({
    id: `qa-week-${i}-${Date.now()}`, startedAt: new Date(Date.now() - (WEEKS - i) * 7 * 864e5).toISOString(),
    seed: week.seed, dishes: week.dishes.slice(0, 3).map((d) => ({ title: d.title, blurb: d.blurb })),
  });
  await p.request.post(h.B + "/api/storage", { data: { key: "mise:history-v1", value: JSON.stringify(history) } });
  await p.request.post(h.B + "/api/storage", { data: { key: "mise:week-v1", value: JSON.stringify({}) } });
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

(async () => {
  if (!KEY) { console.error("Set GEMINI_API_KEY for the judge."); process.exit(1); }
  let result;
  if (process.env.REJUDGE) {
    result = JSON.parse(fs.readFileSync(process.env.REJUDGE, "utf8"));
  } else {
    result = { at: new Date().toISOString(), levels: {} };
    const b = await h.launch();
    for (const level of LEVELS) {
      const p = await h.newUser(b, { ...BASE, adventure: level });
      const history = [], weeks = [];
      for (let i = 0; i < WEEKS; i++) {
        await p.goto(h.B + "/app"); await p.waitForTimeout(1500);
        const w = await h.startWeek(p).then(() => readWeek(p)).catch((e) => ({ seed: {}, dishes: [], error: e.message.split("\n")[0] }));
        weeks.push(w);
        console.log(`level ${level} week ${i + 1}: ${w.dishes.map((d) => d.title).join(" | ") || w.error}`);
        if (w.dishes.length) await archiveAndReset(p, w, i, history);
      }
      result.levels[level] = { weeks };
      await p.ctx.close();
    }
    await b.close();
  }

  // Blind judging: every dish, shuffled.
  const all = [];
  for (const [level, l] of Object.entries(result.levels)) l.weeks.forEach((w, wi) => w.dishes.forEach((d, di) => all.push({ level: Number(level), wi, di, ...d })));
  /* JUDGE_RUNS > 1 averages several blind passes, each freshly shuffled: one
     pass over ~50 dishes moved a level's mean by 0.3 between identical runs. */
  const RUNS = Math.max(1, Number(process.env.JUDGE_RUNS || 1));
  const sums = all.map(() => []);
  let model;
  for (let run = 0; run < RUNS; run++) {
    const order = all.map((_, i) => i).sort(() => Math.random() - 0.5);
    const r = await blindJudge(order.map((i) => all[i]));
    model = r.model;
    order.forEach((i, k) => { if (r.scores[k]) sums[i].push(r.scores[k]); });
  }
  all.forEach((d, i) => { d.score = sums[i].length ? Math.round((10 * sums[i].reduce((a, b) => a + b, 0)) / sums[i].length) / 10 : null; });
  result.judge = RUNS > 1 ? `${model} ×${RUNS}` : model;

  const byLevel = {};
  for (const lv of Object.keys(result.levels).map(Number)) {
    const s = all.filter((d) => d.level === lv && d.score).map((d) => d.score);
    byLevel[lv] = { mean: mean(s), n: s.length, high: s.filter((x) => x >= 4).length };
  }
  const lv = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  const steps = lv.slice(1).filter((l, i) => byLevel[l].mean > byLevel[lv[i]].mean).length;
  const offs = lv.map((l) => Math.abs(byLevel[l].mean - l));
  const lowHigh = lv.filter((l) => l <= 2).reduce((n, l) => n + byLevel[l].high, 0);
  const l5 = byLevel[5];
  const checks = {
    order: [steps === lv.length - 1, `${steps} of ${lv.length - 1}`],
    accuracy: [offs.every((o) => o <= 0.75), lv.map((l, i) => `L${l} ${byLevel[l].mean.toFixed(2)} (off ${offs[i].toFixed(2)})`).join(", ")],
    safe: [lowHigh === 0, `${lowHigh}`],
    bold: [!l5 || l5.high / Math.max(1, l5.n) >= 0.8, l5 ? `${Math.round((100 * l5.high) / Math.max(1, l5.n))}%` : "n/a"],
  };
  result.byLevel = byLevel; result.checks = checks;
  const passed = Object.values(checks).filter(([ok]) => ok).length;

  const md = [`# Mise adventure levels — ${result.at}`, "", `**${passed} of ${QUOTA.length} quota lines met** (blind judge: ${model})`, "",
    "| | Measure | Pass mark | Result |", "|---|---|---|---|",
    ...QUOTA.map(([k, label, mark]) => `| ${checks[k][0] ? "✅" : "❌"} | ${label} | ${mark} | ${checks[k][1]} |`), "",
    "| Level | Blind rating | Dishes |", "|---|---|---|", ...lv.map((l) => `| ${l} | ${byLevel[l].mean.toFixed(2)} | ${byLevel[l].n} |`), ""];
  for (const l of lv) {
    md.push(`## Level ${l}`);
    result.levels[l].weeks.forEach((w, wi) => {
      md.push(`**Week ${wi + 1}**${w.seed?.pantry ? ` — ${w.seed.pantry}` : ""}`);
      all.filter((d) => d.level === l && d.wi === wi).forEach((d) => md.push(`- [${d.score ?? "?"}] ${d.title}${d.cuisine ? ` · ${d.cuisine}` : ""}`));
    });
    md.push("");
  }
  fs.writeFileSync(path.join(OUT, "adventure.md"), md.join("\n"));
  fs.writeFileSync(path.join(OUT, "adventure.json"), JSON.stringify({ ...result, dishes: all }, null, 2));
  console.log(`\n${passed} of ${QUOTA.length} quota lines met`);
  for (const [k, label] of QUOTA) console.log(`${checks[k][0] ? "PASS" : "FAIL"}  ${label}: ${checks[k][1]}`);
})().catch((e) => { console.error(e); process.exit(1); });
