// Recipe-quality eval: are the recipes Mise writes ones a person can actually
// cook from? Recipes are the thing people stand at the stove with, and until
// this nothing measured them.
//
// Each test cook plans a week through the real app, picks three dishes, puts
// them on nights, and builds the shopping list; the app then writes the
// recipes in the background (the prefetch after shopping), exactly as it does
// for a person. Recipes, list and schedule are read back from storage and
// checked mechanically, then a separate model judges each recipe as a cook.
//
//   GEMINI_API_KEY=... BASE_URL=http://localhost:3000 node qa/recipes.js
//   ONLY=small,family node qa/recipes.js       # some cooks
//   REUSE=qa/out/recipes.json node qa/recipes.js
//       # keep each cook's planned week and list from an earlier run and only
//       # rewrite the recipes: 3 calls a cook instead of 5, and before/after
//       # compare the same dishes
//   REJUDGE=qa/out/recipes.json node qa/recipes.js  # re-score, no app calls
//
// Writes recipes.md and recipes.json to $QA_OUT (default qa/out).
const fs = require("fs");
const path = require("path");
const h = require("./harness");

const OUT = process.env.QA_OUT || path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const JUDGE = process.env.JUDGE_MODEL || "gemma-4-31b-it";
const JUDGE_FALLBACK = process.env.JUDGE_FALLBACK || "gemma-4-26b-a4b-it";
const KEY = process.env.GEMINI_API_KEY;
const PICK = 3;

const PROFILES = {
  small: { label: "One person, small kitchen (stovetop + microwave), 25 min",
    profile: { people: 1, nights: ["Tue", "Thu", "Sat"], time: 25, spice: 2, adventure: 3, equipment: ["Stovetop", "Microwave"] } },
  family: { label: "Dairy-free family of 4, 45 min",
    profile: { people: 4, nights: ["Mon", "Wed", "Fri"], time: 45, spice: 1, adventure: 2, restrictions: ["Dairy-free"], equipment: ["Oven", "Stovetop", "Sheet pans", "Big pot", "Slow cooker"] },
    week: { fridge: "half a bag of jasmine rice, a jar of soy sauce" } },
  veg: { label: "Adventurous vegetarian, 2 people, 40 min, spice 3",
    profile: { people: 2, nights: ["Tue", "Thu", "Sun"], time: 40, spice: 3, adventure: 5, restrictions: ["Vegetarian"] } },
  varies: { label: "Headcount varies by night (1, 8, 3), 45 min",
    profile: { people: 2, consistent: false, headcount: { Tue: 1, Thu: 8, Sat: 3 }, nights: ["Tue", "Thu", "Sat"], time: 45, spice: 2, adventure: 3 } },
  noheat: { label: "No heat at all, 2 people, 35 min, craving Thai",
    profile: { people: 2, nights: ["Mon", "Wed", "Sat"], time: 35, spice: 0, adventure: 3 },
    week: { cravings: "Something Thai" } },
};

/* The quota. */
const QUOTA = [
  ["mech", "Mechanical issues per recipe (all checks below)", "avg < 0.5"],
  ["violations", "Restriction / equipment / heat violations", "0"],
  ["servings", "Servings match that night's headcount", "100%"],
  ["time", "Total time within the cook's limit", "100%"],
  ["clarity", "Clarity for a beginner (judge, 1–5)", "avg ≥ 4.0"],
  ["correctness", "Would work as written (judge, 1–5)", "avg ≥ 4.0"],
  ["flavor", "Flavor (judge, 1–5, informational)", "—"],
];
const CHECKS = [
  ["stepsListed", "a. ingredients named in steps are in the components"],
  ["onList", "b. every non-staple ingredient is on the list or on hand"],
  ["time", "c. total time ≤ limit"],
  ["servings", "d. servings = that night's headcount"],
  ["fahrenheit", "e. temperatures only in °F"],
  ["doneness", "f. doneness: sensory cue, plus °F for meat/fish"],
  ["equipment", "g. no step needs missing equipment"],
  ["restrictions", "h. no restriction or heat-ceiling violation"],
  ["quantities", "i. quantities on ingredient lines"],
  ["stepCount", "j. 4–12 steps"],
];

/* ------------------------------------------------------------ word lists
   The restriction terms are qa/real-model.js's (copied: that file runs on
   require). Equipment terms mirror TOOL_TERMS in MiseApp.jsx. */
const SUBSTITUTE = /\b(vegan|plant[- ]based|dairy[- ]free|non[- ]dairy|egg[- ]free|nut[- ]free|meatless|vegetarian|faux|mock|imitation|oat|soy|coconut|rice|almond)\s+(\w+\s+)?\w+|\b\w+\s+(replacer|substitute|alternative)\b|\b(no|without|instead of)\s+\w+/gi;
const MEAT = /\b(chicken|beef|pork|bacon|lamb|turkey|ham|sausage|chorizo|prosciutto|anchov|fish sauce|shrimp|prawn|salmon|tuna|cod|gelatin)\w*/i;
const DAIRY = /\b(milk|butter|cheese|parmesan|cream|yogh?urt|ghee|feta|ricotta|mozzarella|labneh|cr[eè]me|paneer|halloumi)s?\b/i;
const CHILI = /\b(chil[ie]|chilli|jalape|cayenne|sriracha|gochujang|gochugaru|harissa|chipotle|red pepper flakes|hot sauce|scotch bonnet|habanero|serrano|sambal|bird'?s[- ]eye)\w*/i;
const VERY_HOT = /\b(habanero|scotch bonnet|ghost pepper|bird'?s[- ]eye|thai chil\w*)/i;
const TOOLS = [
  [["Oven"], "oven", /(?<!microwave |toaster )\boven\b|\bpreheat|\bbake\b|\broast in\b|\bbroil/i],
  [["Stovetop"], "stovetop", /\b(stovetop|stove|burner|hob|skillet|saucepan|frying pan|wok|kettle)\b/i],
  [["Air fryer"], "air fryer", /\bair[- ]fryer\b/i],
  [["Slow cooker"], "slow cooker", /\bslow cooker|crock ?pot/i],
  [["Blender", "Food processor"], "blender", /\bblender|\bblitz/i],
  [["Food processor", "Blender"], "food processor", /\bfood processor/i],
  [["Grill"], "grill", /\bon the grill|grill grates|outdoor grill|charcoal/i],
  [["Rice cooker"], "rice cooker", /\brice cooker/i],
  [["Sheet pans"], "sheet pan", /\bsheet pan|baking sheet|sheet tray/i],
];
const ANIMAL_PROTEIN = /\b(chicken|beef|pork|lamb|turkey|duck|steak|sausage|salmon|tuna|cod|fish|shrimp|prawn|halibut|tilapia|trout|mackerel|thigh|drumstick|ground meat|meatball)s?\b/i;
const CURED_OR_NOCOOK = /\b(smoked salmon|canned tuna|tinned|anchov|fish sauce|bacon bits|prosciutto)\b/i;
const SENSORY = /\b(golden|brown(?:ed|s)?|crisp\w*|opaque|flakes?|tender|bubbl\w*|fragrant|aromatic|soft\w*|translucent|wilt\w*|thicken\w*|gloss\w*|caramel\w*|char\w*|firm\w*|sizzl\w*|juices run clear|coats? the back|blister\w*|puff\w*|set\b|jiggl\w*|shimmer\w*|reduced|steam\w*|smell\w*|springs? back|sticky|melt\w*|no longer pink|knife slides)/i;
const TEMP_F = /\b1[2-9]\d\s*°?\s*F\b/;

/* Ingredient nouns worth tracking from step text back to the ingredient list.
   Water, salt, pepper and oil are left out on purpose. */
const FOODS = ["chicken", "beef", "pork", "lamb", "turkey", "salmon", "cod", "shrimp", "tofu", "tempeh", "egg", "eggs",
  "onion", "shallot", "garlic", "ginger", "scallion", "leek", "carrot", "celery", "potato", "sweet potato", "tomato",
  "zucchini", "eggplant", "cabbage", "kale", "spinach", "chard", "broccoli", "cauliflower", "mushroom", "lettuce",
  "cucumber", "radish", "beet", "squash", "pumpkin", "corn", "peas", "green beans", "bok choy", "fennel", "asparagus",
  "avocado", "lemon", "lime", "orange", "apple", "mango", "pineapple", "cilantro", "parsley", "basil", "mint", "dill",
  "thyme", "rosemary", "sage", "chive", "rice", "noodles", "pasta", "quinoa", "couscous", "bread", "tortilla", "pita",
  "chickpeas", "lentils", "black beans", "beans", "coconut milk", "stock", "broth", "soy sauce", "fish sauce", "miso",
  "tahini", "peanut", "cashew", "almond", "sesame", "honey", "maple", "mustard", "mayo", "yogurt", "cheese", "butter",
  "cream", "milk", "feta", "parmesan", "wine", "vinegar", "cumin", "paprika", "turmeric", "coriander", "cinnamon",
  "sugar", "flour", "cornstarch", "breadcrumbs", "panko", "olives", "capers", "raisins", "dates", "harissa", "gochujang",
  "kimchi", "sriracha", "jalapeño", "bell pepper", "chickpea", "peanut butter", "hoisin", "oyster sauce", "curry paste",
  "lemongrass", "herbs"];

/* What the recipe prompt calls pantry staples: salt, pepper, cooking oil, water,
   sugar, vinegar and basic dried spices. Everything else has to be bought or on hand. */
const STAPLES = /\b(salt|pepper|peppercorns?|oil|water|ice|sugar|vinegar|cumin|paprika|turmeric|coriander|cinnamon|oregano|chili powder|garlic powder|onion powder|curry powder|garam masala|bay leaf|bay leaves|dried thyme|dried oregano|red pepper flakes|nutmeg|cloves|allspice|cardamom|fennel seeds?|mustard seeds?|cayenne|smoked paprika|dried \w+|ground \w+|spice|cooking spray|baking soda|baking powder)\b/i;
const DESCRIPTORS = new Set(("fresh large small medium big boneless skinless bone-in skin-on ripe dried ground whole chopped minced sliced diced grated " +
  "finely thinly roughly extra firm extra-firm soft low-sodium low sodium reduced canned can tin tinned frozen raw cooked leftover day-old cold warm hot " +
  "red green yellow white black brown baby young english italian thai unsalted salted plain kosher sea toasted roasted packed loosely " +
  "lean ground good-quality quality optional block head bunch heads cloves clove stalks stalk sprigs sprig leaves leaf piece pieces " +
  "bulb bulbs boil-in-bag shredded crumbled peeled seeded halved quartered rinsed drained trimmed").split(/\s+/));
const QTY = /^(?:[\d½¼¾⅓⅔⅛.,/-]+|x|a|an|one|two|three|four|five|six|eight|half|of|about|approx\.?|lbs?|pounds?|oz|ounces?|g|grams?|kg|ml|l|cups?|tbsp|tablespoons?|tsp|teaspoons?|cans?|tins?|packs?|packages?|bags?|bottles?|jars?|pinch(?:es)?|handfuls?|dash|splash|bunch(?:es)?|heads?|cloves?|stalks?|sprigs?|pieces?|inch|in\.?|knob|thumb|sticks?|blocks?|slices?|fillets?|quarts?|pints?|liters?|cartons?)$/i;
const sing = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? (/(?:oes|ches|shes)$/.test(w) ? w.slice(0, -2) : w.slice(0, -1)) : w);
const SYN = { scallion: "green onion", "spring onion": "green onion", coriander: "cilantro", garbanzo: "chickpea" };

/* "2 lb boneless chicken thighs, patted dry (about 6)" -> ["chicken", "thigh"]. */
function coreWords(line) {
  let t = String(line).toLowerCase().replace(/\([^)]*\)/g, " ").split(/,|;| — | - | for /)[0];
  for (const [a, b] of Object.entries(SYN)) t = t.replace(new RegExp(`\\b${a}s?\\b`, "g"), b);
  const ws = t.replace(/[^\p{L}\s'-]+/gu, " ").split(/\s+/).filter(Boolean);
  while (ws.length && QTY.test(ws[0])) ws.shift();
  return ws.filter((w) => w.length > 2 && !DESCRIPTORS.has(w) && !QTY.test(w) && !/^(and|or|the|to|taste|plus|more|serve|serving|garnish|into|cut|about)$/.test(w)).map(sing);
}
function keyOf(line) {
  return coreWords(line).join(" ");
}
/* On the list (or on hand) if the ingredient's head noun is in some list line
   and at least half of its other words are too. */
function onList(line, listKeys) {
  const w = coreWords(line);
  if (!w.length) return true;
  const head = w[w.length - 1];
  return listKeys.some((k) => {
    const ks = new Set(k.split(" "));
    if (!ks.has(head)) return false;
    const others = w.slice(0, -1);
    return others.filter((x) => ks.has(x)).length >= Math.ceil(others.length / 2);
  });
}
const has = (text, word) => new RegExp(`\\b${word.replace(/s$/, "")}(?:s|es)?\\b`, "i").test(text);

function minutesOf(s) {
  const t = String(s || "").toLowerCase();
  const range = t.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:min|minutes|m\b)/);
  if (range) return Number(range[2]);
  const hr = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const mn = t.match(/(\d+)\s*(?:m|min|mins|minutes)\b/);
  if (!hr && !mn) { const n = t.match(/\d+/); return n ? Number(n[0]) : null; }
  return Math.round((hr ? Number(hr[1]) * 60 : 0) + (mn ? Number(mn[1]) : 0));
}

function checkRecipe(r, ctx) {
  const items = (r.components || []).flatMap((c) => c.items || []);
  const comps = items.join(" \n ");
  const steps = (r.steps || []).map((s) => s.do);
  const stepText = steps.join(" \n ");
  const whole = [r.title, comps, stepText, r.doneness, r.seasoning, r.assembly, ...(r.steps || []).map((s) => s.why)].join(" \n ");
  const out = {};
  const put = (k, ok, detail = "") => { out[k] = { ok: !!ok, detail: ok ? "" : String(detail) }; };

  // a. step ingredients listed. "Coriander" as a spice is a staple; "eggs" counts "egg".
  const unlisted = FOODS.filter((f) => has(stepText, f) && !has(comps, f) && !has(comps, f.split(" ").pop()))
    .filter((f) => !(f === "herbs" || f === "stock" && has(comps, "broth") || f === "broth" && has(comps, "stock")));
  put("stepsListed", unlisted.length === 0, unlisted.join(", "));

  // b. bought or on hand
  const listKeys = [...ctx.shopping.map((i) => keyOf(i.item)), ...String(ctx.onHand || "").split(/,|;| and /).map(keyOf)].filter(Boolean);
  const staple = (i) => { const k = coreWords(i).join(" "); return STAPLES.test(k) && !/\b(bell|sweet|poblano|banana) pepper/.test(k); };
  const notBought = items.filter((i) => !staple(i) && !onList(i, listKeys));
  put("onList", notBought.length === 0, notBought.join("; "));

  // c. time
  const mins = minutesOf(r.time);
  put("time", mins != null && mins <= ctx.limit, `${r.time || "(none)"} > ${ctx.limit} min`);

  // d. servings
  const serves = Number(String(r.servings || "").match(/\d+/)?.[0]);
  put("servings", serves === ctx.headcount, `"${r.servings}" for ${ctx.headcount}`);

  // e. Fahrenheit
  const celsius = whole.match(/\d+\s*°\s*C\b|\bcelsius\b|\d+\s*degrees\s*C\b/gi);
  put("fahrenheit", !celsius, (celsius || []).join(", "));

  // f. doneness
  const protein = ANIMAL_PROTEIN.test(comps.replace(/\b(fish sauce|oyster sauce|chicken (stock|broth)|beef (stock|broth)|vegetable broth)\b/gi, "")) && !CURED_OR_NOCOOK.test(comps.replace(/fish sauce/gi, "")) ;
  const sensory = SENSORY.test(`${stepText} ${r.doneness}`);
  const temp = TEMP_F.test(`${stepText} ${r.doneness}`) && /\b(1[4-6][05])\s*°?\s*F/.test(`${stepText} ${r.doneness}`);
  put("doneness", sensory && (!protein || temp), !sensory ? "no sensory cue" : "meat/fish without a safe °F temperature");

  // g. equipment
  const owned = new Set(ctx.equipment);
  const needs = TOOLS.filter(([anyOf, , re]) => !anyOf.some((e) => owned.has(e)) && re.test(stepText)).map(([, label]) => label);
  const badTools = needs.filter((n) => !(n === "sheet pan" && owned.has("Oven")));
  put("equipment", badTools.length === 0, badTools.join(", "));

  // h. restrictions and heat
  const clean = whole.replace(SUBSTITUTE, " ");
  const viol = [];
  const said = (ctx.restrictions || []).join(" ").toLowerCase();
  if (/vegan|vegetarian/.test(said) && MEAT.test(clean)) viol.push(clean.match(MEAT)[0]);
  if (/vegan|dairy/.test(said) && DAIRY.test(clean)) viol.push(clean.match(DAIRY)[0]);
  if (ctx.spice === 0 && CHILI.test(clean)) viol.push(clean.match(CHILI)[0]);
  if (ctx.spice === 1 && VERY_HOT.test(clean)) viol.push(clean.match(VERY_HOT)[0]);
  put("restrictions", viol.length === 0, viol.join(", "));

  // i. quantities
  const noQty = items.filter((i) => !/[\d½¼¾⅓⅔⅛]|\b(a|an|one|two|three|four|half|pinch|handful|dash|splash|to taste|few|some|squeeze|drizzle|juice of|zest of)\b/i.test(i));
  put("quantities", noQty.length === 0, noQty.join("; "));

  // j. step count
  put("stepCount", steps.length >= 4 && steps.length <= 12, `${steps.length} steps`);

  const issues = Object.values(out).filter((x) => !x.ok).length;
  return { checks: out, issues };
}

/* ------------------------------------------------------------- judge */
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

/* One call per recipe: a long batch made the judge skim. */
async function judgeRecipe(r, ctx) {
  const prompt = `You are a demanding recipe tester for a cooking magazine. A home cook will follow this recipe exactly as written, tonight.

The cook: ${ctx.label}. Appliances: ${ctx.equipment.join(", ")}. With a stovetop they have ordinary pots, pans, a skillet and lids; everyone has a knife, board, bowls, spoons, a spatula and measuring cups. Restrictions: ${(ctx.restrictions || []).join(", ") || "none"}. Chili-heat ceiling (spiciness, NOT stove heat): ${ctx.spice} on 0-4. Cooking for ${ctx.headcount} tonight, about ${ctx.limit} minutes. A °F doneness temperature is welcome when a visual cue is given too; don't count a thermometer as missing equipment.

RECIPE:
${JSON.stringify({ title: r.title, servings: r.servings, time: r.time, doneness: r.doneness, components: r.components, steps: r.steps }, null, 1)}

Score 1-5 each, strictly (5 = you'd print it as is; 3 = usable but a beginner would hit snags; 1 = would fail):
- clarity: could a nervous beginner follow it without guessing — amounts, pan sizes, heat levels, times with cues, order of work
- correctness: would it work as written — quantities sensible for the servings, times and temperatures right, nothing used that wasn't listed or prepared, steps in a workable order, fits the time and equipment
- flavor: would it taste good — seasoned throughout, balanced, a real dish
List every concrete problem (short, specific: "step 3 adds the rice but no rice is listed"). Empty if none.

Return JSON only: {"clarity":1-5,"correctness":1-5,"flavor":1-5,"problems":["..."]}`;
  for (const model of [JUDGE, JUDGE_FALLBACK]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const out = await gemini(model, prompt); return { model, ...out }; }
      catch (e) {
        if (e.status === 503 || e.status === 500 || e instanceof SyntaxError) { await new Promise((res) => setTimeout(res, 6000 * (attempt + 1))); continue; }
        if (e.status === 429 || e.status === 404) break;
        throw e;
      }
    }
  }
  return { model: "none", error: "judge unavailable" };
}

/* ------------------------------------------------------------- driving */
async function readState(p) {
  const r = await p.request.get(h.B + "/api/storage?key=mise:week-v1").then((x) => x.json()).catch(() => ({}));
  return r?.value ? JSON.parse(r.value) : {};
}

/* Pick, put each dish on a night, shop. Days are assigned on purpose so every
   recipe has a night and a headcount to be checked against. */
async function planAndShop(p, nights) {
  const adds = p.locator(".dish__add:not(.dish__add--on)");
  const count = Math.min(PICK, await adds.count());
  for (let i = 0; i < count; i++) { await adds.first().click(); await p.waitForTimeout(200); }
  await p.locator(".wiz button").last().click(); await p.waitForTimeout(800);   // Plan my week
  for (let i = 0; i < count && i < nights.length; i++) {
    await p.locator(`#sel-${nights[i]}`).selectOption({ index: i + 1 }); await p.waitForTimeout(200);
  }
  await p.getByRole("button", { name: /Make my shopping list/ }).click();
  await h.idle(p, 150000);
}

/* The app writes the recipes in the background once the list lands. Wait for
   all of them in storage; if one never comes (a failed prefetch only retries
   on demand), open it from Cooking like a person would. */
async function waitForRecipes(p, ms = 360000) {
  const t0 = Date.now();
  let d = {};
  const want = () => (d.candidates || []).filter((c) => c.reaction === "yes").map((c) => c.id);
  while (Date.now() - t0 < ms) {
    d = await readState(p);
    const ids = want();
    if (ids.length && ids.every((id) => d.recipes?.[id]?.steps?.length)) return d;
    await p.waitForTimeout(3000);
  }
  for (const c of (d.candidates || []).filter((x) => x.reaction === "yes" && !d.recipes?.[x.id])) {
    await h.openRecipe(p, new RegExp(c.title.slice(0, 12).replace(/[^\w ]/g, "."))).catch(() => {});
  }
  await p.waitForTimeout(2000);
  return readState(p);
}

async function runCook(b, id, cfg, reuse) {
  const p = await h.newUser(b, cfg.profile);
  if (reuse) {
    const st = { ...reuse, recipes: {}, doneSteps: {}, recipeAsks: {}, view: "cook" };
    await p.request.post(h.B + "/api/storage", { data: { key: "mise:week-v1", value: JSON.stringify(st) } });
    await p.goto(h.B + "/app"); await p.waitForTimeout(1500);
  } else {
    await h.startWeek(p, cfg.week || {});
    await planAndShop(p, cfg.profile.nights);
  }
  const state = await waitForRecipes(p);
  const calls = p.log.length;
  const errs = [...p.errs, await h.alertText(p)].filter(Boolean);
  await p.ctx.close();
  return { state, calls, errs };
}

function analyse(id, cfg, state) {
  const pr = { people: 1, consistent: true, headcount: {}, spice: 2, equipment: ["Oven", "Stovetop", "Cast iron pan", "Sheet pans", "Rice cooker"], restrictions: [], ...cfg.profile };
  const dayOf = Object.fromEntries(Object.entries(state.week || {}).map(([d, dishId]) => [dishId, d]));
  const shopping = (state.shopping || []).filter((i) => !i.removed);
  const onHand = [state.thisWeek?.fridge, ...shopping.filter((i) => i.have).map((i) => i.item)].filter(Boolean).join(", ");
  return (state.candidates || []).filter((c) => c.reaction === "yes").map((c) => {
    const day = dayOf[c.id] || null;
    const headcount = pr.consistent ? pr.people : Number(pr.headcount?.[day]) || pr.people;
    const r = state.recipes?.[c.id];
    const ctx = { label: cfg.label, limit: pr.time, headcount, equipment: pr.equipment, restrictions: pr.restrictions, spice: pr.spice, shopping, onHand };
    if (!r) return { dish: c.title, day, headcount, missingRecipe: true, ctx: { limit: ctx.limit, headcount } };
    return { dish: c.title, day, headcount, recipe: r, ...checkRecipe(r, ctx), ctxFull: ctx };
  });
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

(async () => {
  if (!KEY) { console.error("Set GEMINI_API_KEY for the judge."); process.exit(1); }
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const ids = Object.keys(PROFILES).filter((k) => !only || only.includes(k));
  let result;
  if (process.env.REJUDGE) {
    result = JSON.parse(fs.readFileSync(process.env.REJUDGE, "utf8"));
    result.rejudged = new Date().toISOString();
  } else {
    const reuse = process.env.REUSE ? JSON.parse(fs.readFileSync(process.env.REUSE, "utf8")) : null;
    result = { at: new Date().toISOString(), reused: process.env.REUSE || null, cooks: {} };
    const b = await h.launch();
    for (const id of ids) {
      const t0 = Date.now();
      const prev = reuse?.cooks?.[id]?.state;
      const run = await runCook(b, id, PROFILES[id], prev ? stripRecipes(prev) : null)
        .catch((e) => ({ state: {}, calls: 0, errs: [e.message.split("\n")[0]] }));
      result.cooks[id] = { label: PROFILES[id].label, state: run.state, calls: run.calls, errs: run.errs, secs: Math.round((Date.now() - t0) / 1000) };
      // Saved as it goes, so a run cut short can still be judged with REJUDGE.
      fs.writeFileSync(path.join(OUT, "recipes.json"), JSON.stringify(result, null, 2));
      console.log(`${id}: ${run.calls} calls, ${Object.keys(run.state.recipes || {}).length} recipes ${run.errs.length ? `(${run.errs.join(" / ")})` : ""}`);
    }
    await b.close();
  }

  // ---- check and judge
  for (const id of Object.keys(result.cooks)) {
    const c = result.cooks[id];
    c.recipes = analyse(id, PROFILES[id], c.state || {});
    // The judge is slow (~1-2 min a recipe), so a cook's recipes are judged together.
    await Promise.all(c.recipes.filter((x) => !x.missingRecipe).map(async (x) => {
      x.judge = await judgeRecipe(x.recipe, x.ctxFull);
      delete x.ctxFull;
      console.log(`  ${x.dish} [${x.day || "no day"}, ${x.headcount}]: ${x.issues} issues; judge ${x.judge.clarity}/${x.judge.correctness}/${x.judge.flavor}`);
    }));
  }

  // ---- score against the quota
  const all = Object.values(result.cooks).flatMap((c) => c.recipes);
  const got = all.filter((x) => !x.missingRecipe);
  const missing = all.length - got.length;
  const issuesAvg = got.length ? (got.reduce((n, x) => n + x.issues, 0) + missing * CHECKS.length) / all.length : 99;
  const violations = got.filter((x) => !x.checks.restrictions.ok).length + got.filter((x) => !x.checks.equipment.ok).length;
  const pctOk = (k) => (all.length ? got.filter((x) => x.checks[k].ok).length / all.length : 0);
  const js = (k) => got.map((x) => Number(x.judge?.[k])).filter((n) => n > 0);
  const checks = {
    mech: [issuesAvg < 0.5, `${issuesAvg.toFixed(2)} (${got.length}/${all.length} recipes written)`],
    violations: [violations === 0, `${violations}`],
    servings: [pctOk("servings") === 1, `${Math.round(pctOk("servings") * 100)}%`],
    time: [pctOk("time") === 1, `${Math.round(pctOk("time") * 100)}%`],
    clarity: [mean(js("clarity")) >= 4, mean(js("clarity")).toFixed(2)],
    correctness: [mean(js("correctness")) >= 4, mean(js("correctness")).toFixed(2)],
    flavor: [true, mean(js("flavor")).toFixed(2)],
  };
  result.checks = checks;
  result.byCheck = Object.fromEntries(CHECKS.map(([k]) => [k, got.filter((x) => !x.checks[k].ok).length]));
  const passed = QUOTA.filter(([k]) => k !== "flavor" && checks[k][0]).length;
  const calls = Object.values(result.cooks).reduce((n, c) => n + (c.calls || 0), 0);

  const md = [`# Mise recipe quality — ${result.at}${result.reused ? ` (week reused from ${path.basename(result.reused)})` : ""}`, "",
    `**${passed} of ${QUOTA.length - 1} quota lines met** · ${got.length} recipes · ${calls} app AI calls · judge: ${JUDGE}`, "",
    "| | Measure | Pass mark | Result |", "|---|---|---|---|",
    ...QUOTA.map(([k, label, mark]) => `| ${k === "flavor" ? "" : checks[k][0] ? "✅" : "❌"} | ${label} | ${mark} | ${checks[k][1]} |`), "",
    "| Check | Recipes failing |", "|---|---|", ...CHECKS.map(([k, label]) => `| ${label} | ${result.byCheck[k]} |`), ""];
  for (const [id, c] of Object.entries(result.cooks)) {
    md.push(`## ${c.label}`, `${c.calls} calls${c.errs?.length ? ` · ⚠ ${c.errs.join(" / ")}` : ""}`, "");
    for (const x of c.recipes) {
      if (x.missingRecipe) { md.push(`### ${x.dish} — ❌ no recipe written`, ""); continue; }
      md.push(`### ${x.recipe.title || x.dish} — ${x.day || "no day"}, for ${x.headcount}`,
        `servings "${x.recipe.servings}" · time "${x.recipe.time}" · ${x.recipe.steps.length} steps · **${x.issues} issues** · judge clarity ${x.judge?.clarity} / correctness ${x.judge?.correctness} / flavor ${x.judge?.flavor}`);
      for (const [k, label] of CHECKS) if (!x.checks[k].ok) md.push(`- ✗ ${label}: ${x.checks[k].detail}`);
      for (const pb of x.judge?.problems || []) md.push(`- judge: ${pb}`);
      md.push("");
    }
  }
  fs.writeFileSync(path.join(OUT, "recipes.md"), md.join("\n"));
  fs.writeFileSync(path.join(OUT, "recipes.json"), JSON.stringify(result, null, 2));
  console.log(`\n${passed} of ${QUOTA.length - 1} quota lines met (${calls} app calls)`);
  for (const [k, label] of QUOTA) console.log(`${k === "flavor" ? "INFO" : checks[k][0] ? "PASS" : "FAIL"}  ${label}: ${checks[k][1]}`);
  for (const [k, label] of CHECKS) console.log(`      ${label}: ${result.byCheck[k]} failing`);
})().catch((e) => { console.error(e); process.exit(1); });

function stripRecipes(state) {
  const { recipes, ...rest } = state;
  return rest;
}
