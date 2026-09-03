"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

/* The one definition of the app's directional daylight, shared with the
   sign-in / sign-up / pricing pages so the app and its front door are lit the
   same way. Interpolated into the .surface rule in CSS below. */
import { DAYLIGHT, DAYLIGHT_SOFT } from "@/lib/authStyles";

/* ============================================================================
   MISE — a weekly cooking collaborator
   Built on the weekly-cooking-collaborator skill.

   Design brief: usable by a college student and by someone in their eighties.
   Every action has a button. Typing is always optional. The chat is a shortcut
   for people who want it, never the only road through.
   ========================================================================== */


/* Caching inverts the old design. Loading only the slices a call needs sent fewer
   tokens, but a prompt cache only hits on a byte-identical prefix — so varying the
   prefix per call meant never hitting it. One uniform block is now cheaper: a cached
   read costs a tenth of fresh input, so ~4.4k cached beats ~3.3k fresh every time
   after the first call. Sent as a cached system block, identical on every request. */

/* One shared voice rule for every conversational reply, so "sounds like chat" can't
   drift call by call the way the old scattered per-prompt limits did. JSON field
   caps (blurb/why word counts on dish cards) are separate — those are UI copy, not
   chat, and stay as they are. */
const CHAT_VOICE = `Talk like you're texting a friend who's mid-task, not writing them a
note. One sentence is a complete reply. Two is normal. Three only when you're actually
walking through steps or listing real options. Say the one thing that matters and stop —
don't restate the question, don't recap what they just told you, don't soften with a
preamble ("Great question!", "So here's the thing"). Contractions. Fragments are fine.`;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* Sorting only at the point of selection wasn't enough: a profile saved by an
   older build (or any future write that bypasses the toggle) loads an unsorted
   array and stays that way. Normalise on every read instead. */
const orderDays = (arr) => DAYS.filter((d) => (arr || []).includes(d));
const DAY_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

const SPICE = [
  { v: 0, label: "None at all", note: "No chili heat. Black pepper is fine." },
  { v: 1, label: "A little", note: "Warmth in the background, nothing sharp." },
  { v: 2, label: "Medium", note: "You can taste the heat and you like it there." },
  { v: 3, label: "Hot", note: "Bring the chili forward." },
  { v: 4, label: "As hot as it gets", note: "No mercy." },
];

const ADVENTURE = [
  { v: 1, label: "Food I already know", note: "Comfort. Nothing unfamiliar." },
  { v: 2, label: "Familiar with a twist", note: "Dishes I know, done a bit differently." },
  { v: 3, label: "New but recognizable", note: "I haven't made it, but I know what it is." },
  { v: 4, label: "Show me something new", note: "I've never made this and it sounds interesting." },
  { v: 5, label: "Push me", note: "Show me something I haven't cooked before." },
];

const RESTRICTIONS = [
  "Vegetarian", "Vegan", "Pescatarian", "No pork", "No red meat",
  "Gluten-free", "Dairy-free", "Egg-free", "Soy-free",
  "Nut allergy", "Shellfish allergy", "Halal", "Kosher", "Low salt",
];

const EQUIPMENT = [
  "Oven", "Stovetop", "Cast iron pan", "Nonstick pan", "Big pot", "Rice cooker",
  "Sheet pans", "Blender", "Food processor", "Air fryer", "Grill", "Microwave", "Slow cooker",
];

/* ────────────────────────────────────────────────────────────────────────────
   THE WEEK SEED

   Repetition was never a reasoning failure — it was a determinism failure. Same
   prompt, same distribution, same handful of attractors, week after week. No
   instruction fixes that, because the model has no source of entropy: asking it
   to "be varied" is asking it to do the one thing a deterministic sampler can't.

   So entropy comes from here instead. Before the model sees anything, the app
   draws a tradition, a set of formats, a vegetable and a technique. The model's
   job changes from "invent a varied week" (which it does badly) to "make THIS
   week good" (which it does very well). The skill's own Phase 2 says constraints
   inspire; this applies that to the generation process itself.

   Two things fall out of it. The named-example attractor dies, because the entry
   point is no longer "what comes to mind." And the repertoire becomes an
   auditable asset — a list you can read, expand, and be held to, rather than
   whatever happened to be salient in the weights.
   ──────────────────────────────────────────────────────────────────────────── */

/* Deliberately enumerated and deliberately wide. Left to its own devices the
   model's implicit repertoire skews hard to a few cuisines; this is the fix, and
   it's the cheapest depth signal there is — week nine proposing a Georgian
   walnut sauce reads as range in a way no amount of prose can. */
const TRADITIONS = [
  "Sichuan", "Hunan", "Cantonese", "Shanghainese", "Japanese", "Korean",
  "Vietnamese", "Thai", "Malaysian", "Filipino", "Bengali", "Gujarati",
  "South Indian", "Punjabi", "Sri Lankan", "Persian", "Lebanese", "Turkish",
  "Georgian", "Armenian", "Egyptian", "Moroccan", "Tunisian", "Senegalese",
  "Nigerian", "Ethiopian", "South African", "Oaxacan", "Yucatecan",
  "Northern Mexican", "Peruvian", "Brazilian", "Argentine", "Cuban",
  "Puerto Rican", "Jamaican", "Southern Italian", "Northern Italian",
  "Basque", "Catalan", "Provençal", "Lyonnaise", "Greek", "Portuguese",
  "Polish", "Hungarian", "Georgian Black Sea", "Levantine", "Cajun",
  "Lowcountry", "Appalachian", "Pacific Northwest", "New Mexican",
];

/* Each format carries what it actually requires, so the list can be filtered
   against the person's kitchen IN CODE rather than asking the model to remember
   to adapt. A format that needs a tool they don't own is never put in front of
   it — the model cannot violate a constraint it was never shown. */
const FORMATS = [
  { name: "a braise or stew", needs: ["Stovetop", "Big pot", "Slow cooker"] },
  { name: "a sheet-pan roast", needs: ["Oven", "Sheet pans"] },
  { name: "a grain or legume bowl", needs: [] },
  { name: "a noodle or pasta dish", needs: ["Stovetop", "Big pot"] },
  { name: "a soup", needs: ["Stovetop", "Big pot", "Microwave", "Slow cooker"] },
  { name: "a handheld — wrap, taco, sandwich", needs: [] },
  { name: "a plate a vegetable genuinely leads", needs: [] },
  { name: "a hard sear in a hot pan", needs: ["Cast iron pan", "Nonstick pan", "Stovetop"] },
  { name: "something raw or barely cooked", needs: [] },
  { name: "a steamed dish", needs: ["Microwave", "Big pot", "Stovetop"] },
  { name: "eggs as dinner", needs: ["Stovetop", "Nonstick pan", "Microwave"] },
  { name: "a bake or gratin", needs: ["Oven"] },
];

/* Underused on purpose. The vegetable slot has drifted to whatever is easiest to
   prep — first cabbage, then broccoli once cabbage was corrected. Weighting the
   draw against recent history is the mechanical version of that correction, and
   unlike a written rule it can't be quietly deprioritised. */
const VEGETABLES = [
  "fennel", "celery root", "kohlrabi", "leeks", "parsnips", "turnips",
  "delicata squash", "chard", "escarole", "radicchio", "endive", "collards",
  "Brussels sprouts", "cauliflower", "broccoli", "cabbage", "carrots",
  "green beans", "asparagus", "eggplant", "zucchini", "peppers", "corn",
  "sweet potatoes", "beets", "kale", "spinach", "snap peas", "okra",
  "artichokes", "cucumbers", "tomatoes", "mushrooms", "potatoes", "peas",
];

/* Rough seasonal windows by month index (0 = January). Not a hard filter — a
   nudge, because in-season produce is cheaper, better, and less likely to be
   wasted. Also free variety: the calendar rotates the slot without being asked. */
const SEASON = {
  0: ["cabbage", "kale", "leeks", "parsnips", "turnips", "celery root", "beets", "collards"],
  1: ["cabbage", "kale", "leeks", "parsnips", "chard", "radicchio", "endive", "fennel"],
  2: ["asparagus", "leeks", "chard", "spinach", "radicchio", "fennel", "escarole"],
  3: ["asparagus", "peas", "spinach", "snap peas", "chard", "artichokes"],
  4: ["asparagus", "peas", "snap peas", "spinach", "zucchini", "artichokes"],
  5: ["zucchini", "green beans", "peppers", "cucumbers", "tomatoes", "corn"],
  6: ["corn", "tomatoes", "zucchini", "peppers", "eggplant", "okra", "cucumbers"],
  7: ["corn", "tomatoes", "eggplant", "peppers", "okra", "green beans", "zucchini"],
  8: ["eggplant", "peppers", "tomatoes", "delicata squash", "kale", "chard", "corn"],
  9: ["delicata squash", "cauliflower", "Brussels sprouts", "kale", "fennel", "beets"],
  10: ["Brussels sprouts", "cauliflower", "cabbage", "parsnips", "celery root", "kohlrabi"],
  11: ["cabbage", "kale", "leeks", "parsnips", "turnips", "celery root", "Brussels sprouts"],
};

/* A hidden progression, never surfaced as a curriculum or a progress bar. The
   point is that the model should know they've already done a hard sear six times
   and should stop explaining it — and should have something new to teach. */
const TECHNIQUES = [
  "a pan sauce built from the fond",
  "a proper hard sear and why the pan must be dry",
  "an emulsion — how a dressing holds together",
  "blooming whole spices in fat",
  "salting ahead, and what it does to texture",
  "a quick pickle as a component rather than a condiment",
  "resting meat, and carryover heat",
  "building a braise's liquid so it reduces into a sauce",
  "toasting and grinding a spice blend",
  "using starchy cooking water to bind a sauce",
  "a compound butter or flavoured fat",
  "reducing to concentrate rather than thickening with starch",
];

/* Weighted draw: anything used in the recent past is far less likely to come up
   again, which is what makes week twelve feel different from week one. */
function drawWeighted(pool, recent, recencyWindow = 8) {
  const seen = new Map();
  recent.slice(0, recencyWindow).forEach((v, i) => {
    // more recent = heavier penalty
    seen.set(v, Math.max(seen.get(v) || 0, recencyWindow - i));
  });
  const weighted = pool.map((item) => {
    const penalty = seen.get(item) || 0;
    return { item, w: 1 / (1 + penalty * penalty) };
  });
  const total = weighted.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const { item, w } of weighted) {
    r -= w;
    if (r <= 0) return item;
  }
  return weighted[weighted.length - 1].item;
}

/* Formats the person's kitchen can actually produce. Always leaves the
   equipment-free formats available, so even a microwave-only kitchen has real
   options rather than an empty list. */
function availableFormats(equipment) {
  const owned = new Set(equipment || []);
  return FORMATS.filter((f) => f.needs.length === 0 || f.needs.some((n) => owned.has(n)));
}

function drawWeekSeed(profile, history, month = new Date().getMonth()) {
  const recentTraditions = (history || []).flatMap((w) => w.seed?.tradition || []);
  const recentVegetables = (history || []).flatMap((w) => w.seed?.vegetable || []);
  const recentTechniques = (history || []).flatMap((w) => w.seed?.technique || []);

  const tradition = drawWeighted(TRADITIONS, recentTraditions, 12);

  // Seasonal produce first, falling back to the full list so the draw never fails.
  const inSeason = (SEASON[month] || []).filter((v) => !(profile.dislikes || "").toLowerCase().includes(v));
  const vegPool = inSeason.length >= 4 ? inSeason : VEGETABLES;
  const vegetable = drawWeighted(vegPool, recentVegetables, 6);

  const technique = drawWeighted(TECHNIQUES, recentTechniques, 10);

  // One format per cooking night, capped — drawn without replacement so no two
  // nights share a shape.
  const pool = availableFormats(profile.equipment);
  const want = Math.min(Math.max(3, orderDays(profile.nights).length), pool.length);
  const formats = [];
  const left = [...pool];
  while (formats.length < want && left.length) {
    formats.push(left.splice(Math.floor(Math.random() * left.length), 1)[0].name);
  }

  return { tradition, vegetable, technique, formats, month };
}

const SECTIONS = ["Produce", "Protein", "Dairy & eggs", "Bakery", "Pantry", "Frozen", "Other"];

/* The list is grouped by section, so an unrecognised section name would render
   nowhere at all — an item silently missing from a shopping list is worse than an
   ugly one. Anything unexpected lands in Other. */
const SECTION_ALIASES = {
  produce: "Produce", fruit: "Produce", fruits: "Produce", vegetables: "Produce", veg: "Produce",
  herbs: "Produce", "fruit & veg": "Produce",
  protein: "Protein", meat: "Protein", butcher: "Protein", fish: "Protein", seafood: "Protein",
  poultry: "Protein", deli: "Protein",
  dairy: "Dairy & eggs", "dairy & eggs": "Dairy & eggs", "dairy and eggs": "Dairy & eggs",
  eggs: "Dairy & eggs", cheese: "Dairy & eggs",
  bakery: "Bakery", bread: "Bakery",
  pantry: "Pantry", dry: "Pantry", "dry goods": "Pantry", spices: "Pantry", condiments: "Pantry",
  grains: "Pantry", canned: "Pantry", oils: "Pantry",
  frozen: "Frozen",
};
function normalizeSection(sec) {
  if (!sec) return "Other";
  const raw = String(sec).trim();
  if (SECTIONS.includes(raw)) return raw;
  return SECTION_ALIASES[raw.toLowerCase()] || "Other";
}

/* Quick asks follow the screen. A stove question is useless while you're picking
   dishes, and the whole point of the buttons is that nobody has to type. */
const QUICK_ASKS = {
  stove: [
    "How do I know it's done?",
    "Is my pan hot enough?",
    "This tastes flat",
    "I think I overcooked it",
    "My smoke alarm is going off",
    "What do I do next?",
  ],
  ideas: [
    "Which would you pick?",
    "Is this too much food for the week?",
    "Which of these is easiest?",
    "Something lighter for one night",
    "Will these taste too similar?",
  ],
  week: [
    "What order should I cook these?",
    "Which should I cook first?",
    "Is this too much for one week?",
    "Which night should be the easy one?",
  ],
  shop: [
    "Take the dill off my list",
    "Swap something for a cheaper option",
    "Anything here I'll end up wasting?",
    "Add what I need for a side salad",
    "Halve the amounts",
  ],
  cook: [
    "Make this less spicy",
    "Swap an ingredient I don't have",
    "Talk me through this before I start",
    "Can I prep any of this ahead?",
  ],
  leftovers: [
    "What's quickest?",
    "What needs using up first?",
    "Can I freeze any of this?",
  ],
  me: [
    "What should I try next?",
    "What am I getting better at?",
    "What do I keep getting wrong?",
  ],
  default: [
    "What should I cook this week?",
    "How does this work?",
    "I'm not sure what I want",
  ],
};

function quickAsksFor(view, atStove) {
  if (atStove) return QUICK_ASKS.stove;
  return QUICK_ASKS[view] || QUICK_ASKS.default;
}

/* A diagnostic vocabulary, not a score. A 3-out-of-5 is uninterpretable — it
   teaches the cook nothing and gives the app nothing to act on. "Flat" is
   actionable in both directions: the person learns that flat means it wanted
   acid, and the app learns they are systematically under-acidifying.
   Each entry carries the fix it implies, so the aggregate below can say
   something specific rather than just counting complaints. */
const MISSING = [
  { label: "Nailed it", fix: null },
  { label: "Tasted flat", fix: "acid — they consistently under-acidify, so build it in and say why" },
  { label: "Too rich", fix: "acid and freshness against fat; lighten the finishing step" },
  { label: "Wanted crunch", fix: "a deliberate textural contrast added at the end" },
  { label: "Boring to eat", fix: "texture and temperature contrast, not more seasoning" },
  { label: "Too spicy", fix: "lower the heat ceiling in practice, not just on paper" },
  { label: "Not spicy enough", fix: "they can take more heat than their setting suggests" },
  { label: "Too much work", fix: "fewer components and fewer pans, not faster cooking" },
  { label: "Too much food", fix: "scale down; they are being over-served" },
];
const MISSING_LABELS = MISSING.map((m) => m.label);

/* What the app has actually learned about their palate, derived from the
   diagnoses rather than asked for. This is the compounding loop: week twelve is
   better than week one because twelve weeks of signal exist. Only fires on a
   real pattern — two of the same diagnosis — because one bad night is noise. */
function palateModel(history) {
  const counts = new Map();
  (history || []).forEach((w) =>
    (w.dishes || []).forEach((d) => {
      if (!d.missing || d.missing === "Nailed it") return;
      counts.set(d.missing, (counts.get(d.missing) || 0) + 1);
    })
  );
  const patterns = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, n]) => {
      const entry = MISSING.find((m) => m.label === label);
      return entry?.fix ? `${label} ${n}x → ${entry.fix}` : null;
    })
    .filter(Boolean);
  return patterns;
}

/* Single colon, no other punctuation — stays inside the documented key shape. */
const STORE_KEY = "mise:profile-v3";
/* Separate key from the profile blob: history grows every week and updates on a
   different rhythm (once at shopping, again on every rating), so it shouldn't ride
   along on the debounced profile save. */
const HISTORY_KEY = "mise:history-v1";

/* --------------------------------------------------------------- model call */

/* Two tiers. Most work needs Sonnet; a few calls are short, low-stakes and
   summarising, where Haiku costs a third as much for input and reads the same. */
let SESSION_CONTEXT = "";

/* Bring-your-own-key lives in localStorage, not in our database. It is read
   here per request, sent once, used, and discarded server-side. Deliberately
   NOT stored via /api/storage like the rest of the profile — that would put
   other people's API credentials in our database, making a breach of our data
   a breach of their OpenAI billing. Browser-local means it never leaves the
   device except to make the call the person asked for. */
const BYOK_KEY = "mise:byok-v1";

function readByok() {
  try {
    const raw = window.localStorage?.getItem(BYOK_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v?.provider && v?.key ? v : null;
  } catch (_) {
    return null;
  }
}

function writeByok(provider, key) {
  try {
    if (!provider || !key) window.localStorage?.removeItem(BYOK_KEY);
    else window.localStorage?.setItem(BYOK_KEY, JSON.stringify({ provider, key }));
    return true;
  } catch (_) {
    return false;
  }
}

async function callClaude(messages, opts = {}) {
  const byok = readByok();
  const res = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, tier: opts.tier || "main",
      maxTokens: opts.maxTokens || 1000, sessionContext: SESSION_CONTEXT,
      // Which doctrine this call actually needs — see the comment on
      // buildDoctrine in lib/doctrine.js. Unset means "everything", so a
      // call site that forgets this degrades to the old behavior rather
      // than running with no doctrine.
      ...(opts.docSlices ? { docSlices: opts.docSlices } : {}),
      ...(byok ? { userProvider: byok.provider, userKey: byok.key } : {}) }),
  });
  if (res.status === 402) { window.location.href = "/pricing?reason=expired"; throw new Error("Redirecting to plans…"); }
  if (res.status === 401) { window.location.href = "/login?reason=expired"; throw new Error("Redirecting to sign in…"); }
  if (!res.ok) {
    // The server sends a specific message for problems only the person can fix
    // — a rejected key, an account out of credit — since a generic error would
    // leave them with no idea it was their own account rather than the app.
    let detail = null;
    try { detail = (await res.json())?.detail; } catch (_) {}
    /* Log the raw status too. The friendly copy below is right for a person,
       but it made every distinct failure look identical while debugging —
       a 502 from the provider, a 504 timeout and a 500 crash all read as
       "couldn't reach the kitchen". This goes to the console, not the screen,
       so the copy stays clean. */
    console.error(`callClaude failed: HTTP ${res.status}`, detail || "(no detail)");
    throw new Error(detail || "Couldn't reach the kitchen just now. Give it another go in a moment.");
  }
  const data = await res.json();
  return data.text || "";
}

/* The constraint check ("fits: no dairy, cast iron only") is a deliberate
   forcing function in the ideas prompt — making the model state the check
   before the dish is what keeps restrictions and equipment honoured. It was
   never meant to be read by anyone, but it was landing appended to the visible
   blurb, so it showed on dish cards and on the share image.

   It now goes in its own "fits" field that nothing renders. This strip is the
   belt to that braces, and it earns its place twice over: weeks already saved
   in history have the tag baked into their stored text, and a model told not
   to repeat something will occasionally repeat it anyway. Runs on ingest, so
   nothing downstream — card, week list, share canvas, print — has to know. */
function stripFits(s) {
  if (typeof s !== "string") return s;
  return s
    // "(fits: no dairy, cast iron only)" in brackets, the usual shape
    .replace(/[([{]\s*fits\s*:[^)\]}]*[)\]}]/gi, "")
    // or trailing and bare, with no closing bracket to anchor on
    .replace(/\s*[—–-]?\s*\bfits\s*:.*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/* Applied wherever a dish enters app state, so a leaked tag can't reach the UI
   from any of the four calls that mint dishes. */
function cleanDish(d) {
  if (!d || typeof d !== "object") return d;
  return { ...d, title: stripFits(d.title), blurb: stripFits(d.blurb), why: stripFits(d.why) };
}

function parseJSON(text, onRepair) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.search(/[[{]/);
  if (s > 0) t = t.slice(s);
  try {
    return JSON.parse(t);
  } catch (_) {}

  const stack = [], cuts = [];
  let inStr = false, esc = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      stack.pop();
      cuts.push([i, stack.slice().reverse().join("")]);
    }
  }
  for (let k = cuts.length - 1; k >= 0; k--) {
    try {
      const parsed = JSON.parse(t.slice(0, cuts[k][0] + 1) + cuts[k][1]);
      onRepair?.();   // the answer was cut off; the caller may need to say so
      return parsed;
    } catch (_) {}
  }
  throw new Error("That answer came back cut off. Please try again.");
}

const uid = () => Math.random().toString(36).slice(2, 9);

/* `basis` is the shopping-list signature stamped onto a recipe purely for local
   staleness checks — every item name and quantity concatenated together. It means
   nothing to the model and was being sent on every negotiation call anyway, twice
   per change. Strip it before a recipe goes into a prompt. */
function forPrompt(recipe) {
  if (!recipe) return recipe;
  const { basis, ...rest } = recipe;
  return rest;
}

/* Photos are stored as data URLs alongside the rating, so they have to be small —
   a raw phone photo is several megabytes and storage caps at 5MB per key. Downscale
   to 900px and re-encode as JPEG, which lands around 80-120KB per picture. */
function shrinkImage(file, maxEdge = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like an image."));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (_) {
          reject(new Error("Couldn't process that image."));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Split free-typed leftovers into discrete items we can hold the model to.
   "Two cooked chicken thighs, half a cabbage and some cold rice" becomes three
   checkable things. Quantity words are stripped so matching works on the noun. */
function parseLeftovers(text) {
  const PREFIX = /^(some|a|an|the|about|half of|half|leftover|leftovers|couple of|couple|few|bit of|bits of|piece of|pieces of|handful of|rest of|remaining|two|three|four|five|\d+)\s+/i;
  return (text || "")
    .split(/[,\n;]+|\band\b|\bplus\b/i)
    .map((x) => {
      let t = x.trim().replace(/[.]+$/, "").trim();
      // Strip stacked quantity words: "half a cabbage" -> "half a" -> "cabbage"
      let guard = 0;
      while (PREFIX.test(t) && guard++ < 5) t = t.replace(PREFIX, "").trim();
      return t;
    })
    .filter((x) => x.length > 2);
}

/* Did an idea actually use this item? Match either direction so "cabbage" hits
   "half a cabbage" and "cooked chicken thighs" hits "chicken". */
function usesItem(idea, item) {
  const hay = [idea.title, idea.blurb, idea.uses, ...(idea.usesItems || [])].join(" ").toLowerCase();
  const needle = item.toLowerCase();
  if (hay.includes(needle)) return true;
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  return words.length > 0 && words.some((w) => hay.includes(w));
}

/* Locale formatting differs across engines and can throw on option combinations.
   A date label is never worth taking down a screen for. */
function fmtDate(d, opts) {
  try {
    return d.toLocaleDateString(undefined, opts);
  } catch (_) {
    try { return d.toDateString(); } catch (_) { return ""; }
  }
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + (Number(n) || 0));
  return fmtDate(d, { weekday: "short", month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------- SHARING
   Rendered to a canvas rather than assembled as DOM, because the output has to
   leave the app as a real image — something you can drop into a message or a
   story. Text export of a menu is forgettable; a card with the person's own
   photo of the food on it is the thing that actually gets shared. */

const SHARE_W = 1080;
const SHARE_H = 1350;

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";

  /* A single word wider than the card can't be wrapped on spaces, so it used to
     run straight off the edge. Break it mid-word instead. */
  const hardBreak = (word) => {
    let chunk = "";
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    return chunk;
  };

  for (const w of String(text || "").split(/\s+/).filter(Boolean)) {
    if (ctx.measureText(w).width > maxWidth) {
      if (line) { lines.push(line); line = ""; }
      line = hardBreak(w);
      continue;
    }
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Mise's toque, drawn straight onto the canvas so the card carries the same mark
   as the app rather than a generic label. */
function drawMark(ctx, x, y, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = "round";
  const hat = new Path2D(
    "M17 24c-3.4 0-5.6-2.6-4.8-5.6.6-2.3 3-3.4 5-2.7.2-3.2 2.9-5.5 6.2-5.2 1.3-2.9 4.6-4.3 7.8-3.3 2.4-2.2 6.3-1.9 8.3.7 2.6-.8 5.4.6 6.3 3.1 2.2-.4 4.3 1 4.7 3.2.5 2.8-1.7 5.4-4.9 5.4z"
  );
  const band = new Path2D("M17 24h28.6v4.6H17z");
  ctx.stroke(hat);
  ctx.stroke(band);
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // a missing photo shouldn't break the card
    img.src = src;
  });
}

/* Cover-fit: fill the frame without distorting the photo. */
function drawCover(ctx, img, x, y, w, h, radius) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/* The same directional daylight the app sits in, rebuilt in canvas: warm high
   left, cool low right, very low saturation. A shared card is the thing people
   see before they ever open the app, so it shouldn't look like a different
   product than the one it's advertising. */
function shareBackground(ctx) {
  ctx.fillStyle = "#FAF5F4";
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  const pools = [
    // sunlight through a window, high left — pale butter, almost white
    [0.04, -0.04, 0.62, "rgba(255,247,228,.95)"],
    // the cool daylight it sits in
    [0.62, -0.06, 0.70, "rgba(233,241,247,.85)"],
    // warm bounce off wood or stone, mid right
    [1.00, 0.42, 0.46, "rgba(246,232,213,.75)"],
    // cool shadow pooling low and right
    [0.78, 1.06, 0.76, "rgba(205,214,224,.65)"],
  ];
  pools.forEach(([x, y, r, color]) => {
    const cx = SHARE_W * x;
    const cy = SHARE_H * y;
    const rad = SHARE_W * r;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  });
}

/* A glass pane: translucent fill, hairline rim, and the specular highlight
   along the top that makes it read as lit material rather than a flat box.
   Canvas has no backdrop blur, so the translucency does the work instead —
   the daylight behind genuinely shows through. */
function glassPanel(ctx, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y + 6, w, h, r);
  ctx.fillStyle = "rgba(87,60,86,.10)";
  ctx.filter = "blur(12px)";
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();

  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(255,255,255,.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // specular top edge
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const spec = ctx.createLinearGradient(0, y, 0, y + 3);
  spec.addColorStop(0, "rgba(255,255,255,.95)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.fillRect(x, y, w, 3);
  ctx.restore();
}

function shareFooter(ctx) {
  drawMark(ctx, 96, SHARE_H - 134, 1.05, "#B44722");
  ctx.fillStyle = "#B44722";
  ctx.font = "800 30px Nunito, system-ui, sans-serif";
  ctx.fillText("Made with Mise", 184, SHARE_H - 98);
  ctx.fillStyle = "#6E6472";
  ctx.font = "600 26px Nunito, system-ui, sans-serif";
  ctx.fillText("a weekly cooking collaborator", 184, SHARE_H - 62);
}

/* A small filled badge rather than bare coloured text. Returns its height so
   the caller can space from its visual bottom edge — canvas draws text from the
   BASELINE, which is what made the old spacing unpredictable: a fixed "y += 74"
   after the eyebrow left a gap that silently changed with the title's font
   size, since the title was shrunk for longer names. */
function drawBadge(ctx, text, x, y, bg = "#B44722", fg = "#fff") {
  ctx.font = "800 26px Nunito, system-ui, sans-serif";
  const padX = 22;
  const h = 48;
  const w = ctx.measureText(text).width + padX * 2;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return h;
}

async function renderDishCard(dish, recipe, photo) {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");
  shareBackground(ctx);

  const img = await loadImage(photo);
  const M = 96;
  const maxW = SHARE_W - M * 2;
  const footerTop = SHARE_H - 200;

  /* Measure everything first, then place — so the block can be positioned as a
     whole rather than accumulating drift down the card. */
  ctx.font = "800 78px Nunito, system-ui, sans-serif";
  let titleSize = 78;
  let titleLines = wrapText(ctx, dish.title, maxW);
  while (titleLines.length > (img ? 2 : 3) && titleSize > 46) {
    titleSize -= 8;
    ctx.font = `800 ${titleSize}px Nunito, system-ui, sans-serif`;
    titleLines = wrapText(ctx, stripFits(dish.title), maxW);
  }
  const titleLead = titleSize * 1.16;

  ctx.font = "600 38px Nunito, system-ui, sans-serif";
  // stripFits: a week saved before the tag moved to its own field still has
  // it inside the stored blurb, and a share image is the most public surface
  // in the app — the last place it should surface.
  const blurbLines = wrapText(ctx, stripFits(dish.blurb) || "", maxW).slice(0, img ? 2 : 3);
  const blurbLead = 52;
  const meta = [recipe?.servings, recipe?.time].filter(Boolean).join("   ·   ");

  const BADGE_H = 48;
  const GAP_BADGE_TITLE = 34;   // visual gaps, measured edge to edge
  const GAP_TITLE_BLURB = 26;
  const GAP_BLURB_META = 34;

  const blockH =
    BADGE_H + GAP_BADGE_TITLE +
    titleLines.length * titleLead +
    (blurbLines.length ? GAP_TITLE_BLURB + blurbLines.length * blurbLead : 0) +
    (meta ? GAP_BLURB_META + 34 : 0);

  let photoBottom = 0;
  if (img) {
    /* The photo takes whatever height is left after the text, rather than a
       fixed 604px. With a fixed height a two-line title pushed the metadata
       line straight through the footer — the text always has to fit, so the
       image is what gives. Clamped so it never gets so short it stops
       reading as a photo. */
    const TOP = 110;
    const GAP_PHOTO_TEXT = 74;
    const available = footerTop - TOP - GAP_PHOTO_TEXT - blockH;
    const ph = Math.max(360, Math.min(620, available));
    glassPanel(ctx, M - 18, TOP - 18, maxW + 36, ph + 36, 40);
    drawCover(ctx, img, M, TOP, maxW, ph, 30);
    photoBottom = TOP + ph;
  } else {
    /* No photo of the food, so a ceramic surface stands in. A share card is an
       advertisement — a bare glass panel reads as a missing image, while a real
       textured surface reads as a considered design choice. Two options chosen
       by the dish title so the same dish always gets the same one: consistent
       across re-shares, and varied across a feed of them. */
    const panelTop = 132;
    const panelH = footerTop - panelTop - 36;
    const key = (dish.title || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const fallback = await loadImage(key % 2 ? "/img/clay.webp" : "/img/glaze.webp");
    if (fallback) {
      // Clipped to the panel's rounded rect, then dimmed so the dark title
      // stays legible on top of it whichever texture came up.
      ctx.save();
      roundRect(ctx, M - 28, panelTop, maxW + 56, panelH, 44);
      ctx.clip();
      drawCover(ctx, fallback, M - 28, panelTop, maxW + 56, panelH, 0);
      // 0.72 washed both textures out to near-identical grey — the terracotta
      // lost all its warmth, which defeated having two. 0.52 keeps them
      // distinguishable while leaving the dark title well above AA contrast
      // (measured, not guessed — see the check in the build notes).
      ctx.fillStyle = "rgba(250,245,244,.52)";
      ctx.fillRect(M - 28, panelTop, maxW + 56, panelH);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 2;
      roundRect(ctx, M - 28, panelTop, maxW + 56, panelH, 44);
      ctx.stroke();
    } else {
      glassPanel(ctx, M - 28, panelTop, maxW + 56, panelH, 44);
    }
    drawMark(ctx, M + 2, panelTop + 58, 1.6, "rgba(180,71,34,.55)");
  }

  const spaceTop = img ? photoBottom + 74 : 132 + 150;
  // With the photo sized to fit, the text block starts right below it rather
  // than being centred in space that may not exist.
  const spaceH = footerTop - spaceTop;
  let y = spaceTop + Math.max(0, (spaceH - blockH) / 2);

  // Badge sits at y; everything after spaces from its visual bottom edge.
  drawBadge(ctx, "I COOKED THIS", M, y);
  y += BADGE_H + GAP_BADGE_TITLE;

  ctx.fillStyle = "#12141C";
  ctx.font = `800 ${titleSize}px Nunito, system-ui, sans-serif`;
  titleLines.forEach((line, i) => {
    // First line drawn at its own baseline, which sits titleSize below the top.
    ctx.fillText(line, M, y + titleSize * 0.82 + i * titleLead);
  });
  y += titleLines.length * titleLead;

  if (blurbLines.length) {
    y += GAP_TITLE_BLURB;
    ctx.fillStyle = "#4A4453";
    ctx.font = "600 38px Nunito, system-ui, sans-serif";
    blurbLines.forEach((line, i) => {
      ctx.fillText(line, M, y + 30 + i * blurbLead);
    });
    y += blurbLines.length * blurbLead;
  }

  if (meta) {
    y += GAP_BLURB_META;
    ctx.fillStyle = "#6E6472";
    ctx.font = "700 30px Nunito, system-ui, sans-serif";
    ctx.fillText(meta, M, y + 24);
  }

  shareFooter(ctx);
  return canvas;
}

async function renderWeekCard(dishes, ecosystem) {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");
  shareBackground(ctx);

  const M = 96;
  const listX = M + 58;
  const maxW = SHARE_W - listX - M;
  const footerTop = SHARE_H - 190;

  // The list sits on a glass pane so the daylight behind it stays visible
  // rather than the whole card reading as flat paper.
  glassPanel(ctx, M - 28, 96, SHARE_W - (M - 28) * 2, SHARE_H - 96 - 210, 44);

  // Same badge treatment as the dish card, so the two read as a set.
  drawBadge(ctx, "THIS WEEK I'M COOKING", M, 142);

  /* Fit the list to the space rather than trusting a fixed size — five long
     titles used to run straight through the footer. Step the type down until it
     fits, and only then drop dishes. */
  const spine = ecosystem
    ? [ecosystem.aromatics, ecosystem.protein, ecosystem.vegetable, ecosystem.flavorSystem].filter(Boolean).join("  ·  ")
    : "";

  let size = 56;
  let shown = dishes.slice(0, 5);
  let layout = null;

  const measure = () => {
    ctx.font = `700 ${size}px Nunito, system-ui, sans-serif`;
    const rows = shown.map((d) => ({
      title: wrapText(ctx, stripFits(d.title), maxW).slice(0, 2),
      blurb: stripFits(d.blurb) || "",
    }));
    const h = rows.reduce((acc, r) => acc + r.title.length * (size + 10) + (r.blurb ? 44 : 0) + 34, 0);
    return { rows, h };
  };

  layout = measure();
  while (layout.h > footerTop - 230 - (spine ? 90 : 0) && size > 34) {
    size -= 6;
    layout = measure();
  }
  while (layout.h > footerTop - 230 - (spine ? 90 : 0) && shown.length > 3) {
    shown = shown.slice(0, shown.length - 1);
    layout = measure();
  }

  let y = 268;
  layout.rows.forEach((r) => {
    ctx.fillStyle = "#EE9265";
    ctx.beginPath();
    ctx.arc(M + 18, y - size * 0.32, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#12141C";
    ctx.font = `800 ${size}px Nunito, system-ui, sans-serif`;
    r.title.forEach((line) => {
      ctx.fillText(line, listX, y);
      y += size + 10;
    });

    if (r.blurb) {
      ctx.fillStyle = "#6E6472";
      ctx.font = "400 32px Nunito, system-ui, sans-serif";
      const b = wrapText(ctx, r.blurb, maxW).slice(0, 1);
      b.forEach((line) => {
        ctx.fillText(line, listX, y);
        y += 44;
      });
    }
    y += 34;
  });

  const hidden = dishes.length - shown.length;
  if (hidden > 0) {
    ctx.fillStyle = "#8A7B86";
    ctx.font = "600 30px Nunito, system-ui, sans-serif";
    ctx.fillText(`+ ${hidden} more`, listX, y);
    y += 50;
  }

  if (spine) {
    ctx.fillStyle = "#8A7B86";
    ctx.font = "400 28px Nunito, system-ui, sans-serif";
    wrapText(ctx, spine, SHARE_W - M * 2).slice(0, 2).forEach((line) => {
      y += 40;
      ctx.fillText(line, M, y);
    });
  }

  shareFooter(ctx);
  return canvas;
}

/* Native share sheet where it exists (that's what makes this a real acquisition
   loop on a phone), download everywhere else. */
async function shareCanvas(canvas, filename, title) {
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png", 0.95));
  if (!blob) return false;

  try {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return true;
    }
  } catch (_) {
    /* cancelled or unsupported — fall through to download */
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ PRINTING
   window.print() is unreliable inside a sandboxed artifact frame — it either
   targets the host page or is blocked outright. So build a standalone document,
   open it in a real window and print from there, and fall back to downloading it
   as an .html file if the popup is blocked. One of the two always works. */

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const PRINT_CSS = `
  @page { margin: 18mm; }
  body { font: 12pt/1.5 Georgia, serif; color:#000; margin:0; }
  h1 { font-size:20pt; margin:0 0 .2rem; }
  h2 { font-size:13pt; margin:1.2rem 0 .3rem; border-bottom:1px solid #000; padding-bottom:.15rem; }
  .sub { color:#444; margin:0 0 1rem; }
  ul,ol { margin:.4rem 0 0; padding-left:2.4rem; }
  /* 1.2rem fit a single digit and clipped everything from "10." onward, because
     the marker renders outside the content box. Wider gutter, and the marker is
     pulled inside the box so it can't fall off the page edge. */
  ol { list-style-position:inside; padding-left:0; }
  ol li { padding-left:2.2rem; text-indent:-2.2rem; }
  ul.box { list-style:none; padding-left:0; }
  li { padding:.22rem 0; page-break-inside:avoid; }
  .box li:before { content:""; display:inline-block; width:11pt; height:11pt;
    border:1px solid #000; margin-right:8pt; vertical-align:-1pt; }
  .why { color:#444; font-style:italic; }
  section { page-break-inside:avoid; }
  @media print { .noprint { display:none; } }
  .noprint { margin-bottom:1rem; font:600 11pt/1.4 system-ui,sans-serif; }
  .noprint button { font:inherit; padding:.5rem 1rem; cursor:pointer; }
`;

function printDoc(title, bodyHtml) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(title)}</title><style>${PRINT_CSS}</style></head>
<body><div class="noprint"><button onclick="window.print()">Print this page</button></div>
${bodyHtml}</body></html>`;

  try {
    const w = window.open("", "_blank");
    if (w && w.document) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 350);
      return true;
    }
  } catch (_) {
    /* popup blocked or sandboxed — fall through to download */
  }

  try {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w -]+/g, "").trim() || "mise"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (_) {
    return false;
  }
}

function printShoppingList(shopping, profile) {
  const groups = SECTIONS.map((s) => [s, shopping.filter((i) => i.section === s)]).filter(([, v]) => v.length);
  const body = `<h1>Shopping List</h1>
<p class="sub">For ${profile.people} ${profile.people === 1 ? "person" : "people"} · ${esc(fmtDate(new Date(), { year: "numeric", month: "long", day: "numeric" }))}</p>
${groups.map(([sec, items]) => `<section><h2>${esc(sec)}</h2><ul class="box">${items
    .map((i) => `<li>${esc([i.qty, i.item].filter(Boolean).join(" "))}${Number(i.days) <= 3 ? ` — use by ${esc(daysFromNow(i.days))}` : ""}</li>`)
    .join("")}</ul></section>`).join("")}`;
  return printDoc("Shopping List", body);
}

function printRecipe(rec) {
  const body = `<h1>${esc(rec.title)}</h1>
<p class="sub">${esc([rec.servings, rec.time].filter(Boolean).join(" · "))}</p>
${(rec.components || []).map((c) => `<section><h2>${esc(c.name || "Ingredients")}</h2><ul class="box">${(c.items || [])
    .map((it) => `<li>${esc(it)}</li>`).join("")}</ul></section>`).join("")}
<section><h2>Steps</h2><ol>${(rec.steps || [])
    .map((s) => `<li>${esc(s.do)}${s.why ? ` <span class="why">${esc(s.why)}</span>` : ""}</li>`).join("")}</ol></section>
${rec.assembly ? `<p><strong>Putting it together.</strong> ${esc(rec.assembly)}</p>` : ""}
${rec.seasoning ? `<p><strong>Taste and adjust.</strong> ${esc(rec.seasoning)}</p>` : ""}`;
  return printDoc(rec.title || "Recipe", body);
}

/* --------------------------------------------------------------- primitives */

function Tape({ children, tone = "tape", tilt = -1 }) {
  return (
    <span className={`tape tape--${tone}`} style={{ transform: `rotate(${tilt}deg)` }}>
      {children}
    </span>
  );
}

function Btn({ children, onClick, variant = "solid", disabled, wide, small, ...rest }) {
  return (
    <button
      type="button"
      className={`btn btn--${variant}${wide ? " btn--wide" : ""}${small ? " btn--sm" : ""}`}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

/* A text field that wraps. An <input> can't — "San Marzano whole peeled tomatoes"
   needs 307px and a phone row has 239px, so the name was always going to read as a
   truncated fragment no matter how the row was arranged. This grows instead. */
function GrowInput({ value, onChange, className = "", ...rest }) {
  const ref = useRef(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(fit, [value]);
  return (
    <textarea autoCapitalize="sentences" autoCorrect="on" spellCheck="true"
      ref={ref}
      rows={1}
      className={`grow ${className}`}
      value={value}
      onChange={(e) => { onChange(e); fit(); }}
      {...rest}
    />
  );
}

function Chip({ active, children, onClick, sub }) {
  return (
    <button type="button" className={`chip${active ? " chip--on" : ""}`} aria-pressed={active} onClick={onClick}>
      <span className="chip__main">{children}</span>
      {sub && <span className="chip__sub">{sub}</span>}
    </button>
  );
}

function Working({ label }) {
  return (
    <p className="working" role="status" aria-live="polite">
      <span className="working__dots" aria-hidden="true"><i /><i /><i /></span>
      {label}
    </p>
  );
}

/* Shown while a list is being built. An empty state during loading reads as a
   failure, which is the bug this fixes — nothing was ever wrong, it just looked wrong. */
/* Card count scales with how many are actually coming — echoes what
   startIdeas asks for, so the placeholder count doesn't overshoot or fall
   short of what actually lands a moment later. */
function DishSkeleton({ count = 4 }) {
  return (
    <div className="dcards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dcard">
          <span className="ph dcard__title" />
          <span className="ph dcard__line" />
          <span className="ph dcard__line--short" />
          <div className="dcard__acts">
            <span className="ph dcard__pill dcard__pill--a" />
            <span className="ph dcard__pill dcard__pill--b" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Skeleton({ title, note, rows = 6 }) {
  return (
    <section className="card" aria-busy="true">
      <h2>{title}</h2>
      <p className="lead">{note}</p>
      <Working label="Working on it" />
      <ul className="skel" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i}><span className="ph" style={{ width: `${88 - (i % 4) * 14}%` }} /></li>
        ))}
      </ul>
    </section>
  );
}

/* A section that stays shut until it's wanted. Measured on a phone, the Cook page
   ran 3.8 screens tall and nearly half of that was the rating form and the change
   panel — neither of which you need while you're reading a recipe. Folding them
   costs one tap and gives the page back. */
function Fold({ title, note, open, onToggle, children, tone = "" }) {
  return (
    <section className={`card fold ${tone}`}>
      <button className="fold__hd" onClick={onToggle} aria-expanded={open}>
        <span className="fold__t">
          <span className="fold__h2">{title}</span>
          {note && <span className="fold__note">{note}</span>}
        </span>
        <span className={`fold__chev${open ? " fold__chev--open" : ""}`} aria-hidden="true">▾</span>
      </button>
      {open && <div className="fold__body">{children}</div>}
    </section>
  );
}

function Empty({ title, children, img, alt }) {
  return (
    <div className="empty">
      {img && (
        <div className="empty__art">
          {/* Decorative: the heading already says what's going on, so a screen
              reader gaining "photograph of an empty paper bag" adds nothing. */}
          <img src={img} alt={alt || ""} loading="lazy" />
        </div>
      )}
      <h2>{title}</h2>
      <div className="empty__b">{children}</div>
    </div>
  );
}

/* Big labelled scale — replaces slider. Sliders are hard for shaky hands. */
function Scale({ options, value, onChange, name }) {
  return (
    <div className="scale" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={`scale__o${value === o.v ? " scale__o--on" : ""}`}
          onClick={() => onChange(o.v)}
        >
          <span className="scale__label">{o.label}</span>
          <span className="scale__note">{o.note}</span>
        </button>
      ))}
    </div>
  );
}

/* =========================================================================== */

async function apiStorageGet(key) {
  const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error("storage unavailable");
  return res.json();
}
async function apiStorageSet(key, value) {
  const res = await fetch("/api/storage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) return null;
  return res.json();
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("start");
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  /* `busy` is only the label shown in the bottom bar. `building` tracks WHICH work is
     in flight, so a screen can show its own progress instead of an empty state that
     looks like a failure. Chained work (list, then leftovers) overlaps, so one flag
     wouldn't do. */
  const [building, setBuilding] = useState({ ideas: false, shopping: false, leftovers: false, recipe: null });
  const mark = (k, v) => setBuilding((b) => ({ ...b, [k]: v }));

  const [profile, setProfile] = useState({
    people: 1,
    consistent: true,
    /* Per-night headcount, only consulted when consistent is false. Missing days
       fall back to `people`, so turning the toggle on doesn't require filling in
       every night before the app works. */
    headcount: {},
    nights: ["Tue", "Thu", "Sat"],
    time: 45,
    spice: 2,
    adventure: 4,
    restrictions: [],
    restrictionsNote: "",
    dislikes: "",
    healthConscious: false,
    equipment: ["Oven", "Stovetop", "Cast iron pan", "Sheet pans", "Rice cooker"],
    smokeAlarm: true,
  });
  const [favorites, setFavorites] = useState([]);
  const [savedAt, setSavedAt] = useState(null);
  /* Separate from savedAt on purpose. savedAt only means "something has been
     written to storage" — and the autosave effect below writes 700ms after
     load, before a new person has answered anything. Using savedAt to decide
     whether onboarding is done meant the intro appeared for exactly that long
     and then vanished, replaced by a "your saved setup" screen summarising a
     profile they never filled in. This flag only becomes true when setup is
     actually completed. */
  const [setupDone, setSetupDone] = useState(false);

  const [thisWeek, setThisWeek] = useState({ fridge: "", cravings: "", request: "" });
  const [convo, setConvo] = useState([]);
  const [thread, setThread] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [ecosystem, setEcosystem] = useState(null);
  const [week, setWeek] = useState({});
  const [shopping, setShopping] = useState([]);
  const [recipes, setRecipes] = useState({});

  /* Recipes are written from the shopping list, so edits to the list have to reach
     them. `excluded` remembers what you deliberately took off; `shoppingSignature`
     lets an already-written recipe notice the list moved under it. */
  const [excluded, setExcluded] = useState([]);
  const [haveOnHand, setHaveOnHand] = useState("");
  const [leftoverIdeas, setLeftoverIdeas] = useState([]);
  const [leftoverSafety, setLeftoverSafety] = useState("");
  const [leftoverRecipes, setLeftoverRecipes] = useState({});

  const [cookingId, setCookingId] = useState(null);
  const [doneSteps, setDoneSteps] = useState({});
  /* Recipe changes are a negotiation, not a command. She answers with named options
     and their tradeoffs; nothing is rewritten until you pick one. */
  /* Its own flag rather than the global busy string: the recipe page was showing
     "working it out" whenever anything anywhere was in flight — an Ask Mise
     question, a rating debrief, another dish's recipe — so it looked stuck long
     after the recipe had arrived. */
  const [negotiating, setNegotiating] = useState(false);
  const [recipeChat, setRecipeChat] = useState([]);
  const [recipeOptions, setRecipeOptions] = useState([]);
  const [cooking, setCooking] = useState(false);   // full-screen cook mode
  const [cookStep, setCookStep] = useState(null);  // so Mise knows where you are
  const [miseOpen, setMiseOpen] = useState(false);
  const [miseThread, setMiseThread] = useState([]);

  /* Each "Start this week" gets a fresh id. Building the shopping list is the
     moment a week becomes a real plan rather than a brainstorm, so that's when it
     gets archived; ratings afterward update the same entry in place. */
  /* When set, the next render should scroll to a specific section instead of the
     top of the page — the jump-to-top effect stands down for it. */
  const [swapTarget, setSwapTarget] = useState(null);   // {item, mode}
  const [scrollTarget, setScrollTarget] = useState(null);
  const [weekId, setWeekId] = useState(null);
  /* The current week's draw. Persisted onto the archived week so future draws can
     weight against it — without that, the weighting has no history and week
     twelve looks exactly like week one again. */
  const [weekSeed, setWeekSeed] = useState(null);
  const [history, setHistory] = useState([]);
  /* null = untested, true = writes land, false = writes are being dropped.
     Artifact storage only works once the artifact is published, and it fails
     silently — so surface it rather than letting people think it saved. */
  const [storageOk, setStorageOk] = useState(null);
  const historyRef = useRef([]);

  const headingRef = useRef(null);

  /* ------------------------------------------------------------- storage */

  useEffect(() => {
    (async () => {
      try {
        const r = await apiStorageGet(STORE_KEY);
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.profile) setProfile((p) => ({ ...p, ...d.profile, nights: orderDays(d.profile.nights ?? p.nights) }));
          if (d.favorites) setFavorites(d.favorites);
          if (d.profile) setSavedAt(d.savedAt || null);
          // Older saves predate this flag; a stored profile with real cooking
          // nights means they got through setup, so don't re-onboard them.
          if (d.setupDone || (d.profile?.nights?.length && d.savedAt)) setSetupDone(true);
        }
      } catch (_) {
        /* first run, or storage unavailable — defaults are fine */
      }
      try {
        const h = await apiStorageGet(HISTORY_KEY);
        if (h?.value) {
          const parsed = JSON.parse(h.value);
          setHistory(parsed);
          historyRef.current = parsed;
        }
      } catch (_) {
        /* no history yet */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  /* Upsert this week's snapshot and write it immediately — unlike the profile,
     losing a save here means losing a real record of what was cooked, not just a
     preference, so it isn't debounced behind a timeout. */
  const archiveWeek = useCallback(
    async (patch) => {
      if (!weekId) return;
      const prev = historyRef.current;
      const idx = prev.findIndex((w) => w.id === weekId);
      const base = idx >= 0 ? prev[idx]
        : { id: weekId, startedAt: new Date().toISOString(), seed: weekSeed || null };
      const merged = { ...base, ...patch, updatedAt: new Date().toISOString() };
      const next = idx >= 0 ? prev.map((w, i) => (i === idx ? merged : w)) : [merged, ...prev];
      /* Photos are data URLs living inside this blob, and storage caps at 5MB per
         key. At roughly 100KB a photo that breaks somewhere around week 20 — and
         it breaks silently, losing everything saved after that point. Keep the
         weeks, drop the pictures from older ones: recent weeks stay illustrated,
         the rest keep their titles, ratings and notes. */
      const PHOTO_WEEKS = 6;
      const MAX_WEEKS = 40;
      const trimmed = next
        .slice(0, MAX_WEEKS)
        .map((w, i) =>
          i < PHOTO_WEEKS
            ? w
            : { ...w, dishes: (w.dishes || []).map(({ photos, ...d }) => d) }
        );

      historyRef.current = trimmed;
      setHistory(trimmed);
      try {
        const res = await apiStorageSet(HISTORY_KEY, JSON.stringify(trimmed));
        // A null return means the write was rejected; undefined means no storage
        // API at all. Only an actual result counts as a confirmed save.
        setStorageOk(res ? true : false);
      } catch (_) {
        setStorageOk(false);
      }
    },
    [weekId]
  );

  useEffect(() => { historyRef.current = history; }, [history]);

  /* Drives the glass highlight's position. One delegated listener rather than
     one per card — cost stays flat no matter how many cards are on screen at
     once, and it works for cards that mount later without extra wiring.
     rAF-throttled so a fast mouse doesn't queue more style writes than the
     screen can actually paint. */
  /* Tilt-driven specular on touch devices. The pointer listener below does
     nothing on a phone — there's no cursor — so the same --gx/--gy variables
     get driven by device orientation instead: tilt the phone and the highlight
     travels across the glass. Needs no permission on Android or on iOS for the
     non-absolute orientation event, and silently does nothing where the sensor
     is absent. */
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = null;
    const onTilt = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        // gamma is left/right tilt (-90..90), beta is front/back (-180..180).
        // Clamped to a usable range so a small wrist movement covers the panel
        // rather than pinning the highlight to an edge.
        const gx = 50 + Math.max(-30, Math.min(30, e.gamma || 0)) * 1.4;
        const gy = 50 + Math.max(-30, Math.min(30, (e.beta || 0) - 40)) * 1.0;
        document.querySelectorAll(".card").forEach((c) => {
          c.style.setProperty("--gx", `${gx}%`);
          c.style.setProperty("--gy", `${gy}%`);
        });
      });
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => {
      window.removeEventListener("deviceorientation", onTilt);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Parallax on the surface behind the glass. */
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        // 12% of scroll distance: enough to read as depth, small enough that
        // the texture never runs out at the bottom of a long page.
        document.documentElement.style.setProperty("--par", `${window.scrollY * -0.12}px`);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = null;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const card = e.target.closest?.(".card");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--gx", `${((e.clientX - r.left) / r.width) * 100}%`);
        card.style.setProperty("--gy", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Ask for a cooking order and actually apply it, rather than producing advice
     the person then has to hand-copy into the day dropdowns. */
  async function suggestOrder() {
    if (chosen.length < 2) return;
    setBusy("Working out the best order");
    setErr("");

    const nights = orderDays(profile.nights);
    /* Numbered lists rather than asking the model to echo back exact day codes
       and dish titles as free text — indices can't be paraphrased, so nothing
       silently fails to match. */
    const prompt = `They want to know what order to cook these in this week.

DISHES THEY PICKED (numbered):
${chosen.map((c, i) => `${i + 1}. ${c.title} — ${c.blurb}`).join("\n")}

NIGHTS AVAILABLE (numbered):
${nights.map((d, i) => `${i + 1}. ${DAY_FULL[d]}`).join("\n")}

Assign each dish to a night. Reason about what actually spoils first (fish and delicate herbs
early, hardy roots and cabbage late), which dish makes leftovers a later night can use, and
which night has least time.

If there are MORE dishes than nights, leave the extras unassigned and say so.
If there are FEWER dishes than nights, say which nights are still open rather than silently
leaving them blank — and offer the two real options: pick another dish, or cook one of these
twice. Cooking something twice in a week is a perfectly reasonable choice, especially if a
dish makes enough for two nights; just don't present it as the default.

Give ONE short line per night — the day, the dish, and the reason in a few words, using the real
day and dish names so it reads naturally. Keep "say" to those lines only, one per line, no preamble.

Respond with ONLY this JSON. "night" and "dish" are the NUMBERS from the numbered lists above,
not the names:
{"say":"Tuesday — Fish tacos, the fish won't keep\nThursday — ...",
"order":[{"night":1,"dish":2}]}`;

    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { docSlices: ["core", "groceries"] });
      const out = parseJSON(raw);

      const next = {};
      (Array.isArray(out.order) ? out.order : []).forEach((o) => {
        const day = nights[Number(o.night) - 1];
        const dish = chosen[Number(o.dish) - 1];
        if (day && dish) next[day] = dish.id;
      });
      if (Object.keys(next).length) setWeek((w) => ({ ...w, ...next }));

      setMiseOpen(true);
      setMiseThread((t) => [
        ...t,
        { who: "me", text: "What order should I cook these?" },
        { who: "mise", text: out.say || "" },
      ]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  /* Write a rating back into an already-archived week. Ratings could previously
     only be captured live on the Cook page, so anything cooked away from the app
     — or rated a day later — had no way in at all. */
  function rateHistoryDish(weekId, dishIndex, patch) {
    setHistory((hs) => {
      const next = hs.map((w) =>
        w.id !== weekId
          ? w
          : {
              ...w,
              dishes: (w.dishes || []).map((d, i) =>
                i !== dishIndex
                  ? d
                  : {
                      ...d,
                      rating: patch.rating,
                      missing: patch.missing,
                      note: patch.note,
                      photos: (patch.photos || []).slice(0, 3),
                    }
              ),
            }
      );
      historyRef.current = next;
      // Matches how archiveWeek persists — same key, same shape, so the port
      // to mise-web rewrites this line along with the others.
      try {
        apiStorageSet(HISTORY_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }

  /* Write a recipe into whichever archived dish it belongs to. Matches on title
     because history entries have their own ids — and only fills a gap, never
     overwrites a recipe already stored, so a rewrite from a later week can't
     clobber what was actually cooked. */
  function stashRecipeInHistory(dishId, recipe, replace = false) {
    const dish = candidates.find((c) => c.id === dishId);
    if (!dish || !recipe) return;
    const title = (dish.title || "").toLowerCase();

    setHistory((hs) => {
      let touched = false;
      const next = hs.map((w) => {
        if (w.id !== weekId) return w;
        const list = w.dishes || [];
        const dishes = list.map((d) => {
          // Only fill a gap by default; `replace` is for a negotiated rewrite,
          // which genuinely supersedes what was stored.
          if ((d.recipe && !replace) || (d.title || "").toLowerCase() !== title) return d;
          touched = true;
          return { ...d, recipe };
        });
        /* A dish picked after the shopping list was built — an adopted
           leftover, a late "yes" — isn't in the archived menu at all, so
           there was no gap to fill and the recipe went nowhere. Add it.
           Repeats are excluded: saveRating deliberately writes those as their
           own dated entry, and adding one here would duplicate it. */
        if (!touched && !list.some((d) => (d.title || "").toLowerCase() === title) && !dish.againOf) {
          touched = true;
          return {
            ...w,
            dishes: [
              ...dishes,
              {
                day: DAYS.find((d) => week[d] === dishId) || null,
                title: dish.title,
                blurb: dish.blurb || "",
                fromLeftovers: !!dish.fromLeftovers,
                rating: null,
                missing: null,
                recipe,
              },
            ],
          };
        }
        return touched ? { ...w, dishes } : w;
      });
      if (!touched) return hs;
      historyRef.current = next;
      try {
        apiStorageSet(HISTORY_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }

  /* Cook something from History again. It becomes a dish in the current week, so
     it inherits cook mode, the recipe page and rating — and rating it again writes
     a fresh dated entry rather than overwriting the old one, so the record shows
     that you've made it twice and how it went each time. */
  function cookAgain(dish) {
    /* If the actual recipe was baked into this history entry, reopen exactly that
       one — same ingredients, same steps, same technique note — rather than asking
       the model to write a fresh recipe that could easily come out differently.
       Older entries saved before this existed won't have it, so that path still
       falls back to generating one. */
    const existing = candidates.find(
      (c) => (c.title || "").toLowerCase() === (dish.title || "").toLowerCase()
    );
    if (existing) {
      setCandidates((cs) => cs.map((c) => (c.id === existing.id ? { ...c, reaction: "yes" } : c)));
      setCookingId(existing.id);
      if (!recipes[existing.id]) {
        if (dish.recipe) {
          setRecipes((r) => ({ ...r, [existing.id]: { ...dish.recipe, basis: shoppingSignature } }));
        } else {
          getRecipe(existing.id);
        }
      }
      setView("cook");
      return;
    }
    const id = uid();
    setCandidates((cs) => [
      ...cs,
      {
        id,
        title: dish.title,
        blurb: dish.blurb || "",
        why: "You've cooked this before",
        reaction: "yes",
        note: "",
        spice: 0,
        againOf: dish.title,
      },
    ]);
    setCookingId(id);
    setView("cook");
    if (dish.recipe) {
      setRecipes((r) => ({ ...r, [id]: { ...dish.recipe, basis: shoppingSignature } }));
    } else {
      setTimeout(() => getRecipe(id), 0);   // after the candidate lands in state
    }
  }

  /* Promote a leftover idea into a real dish. Rather than bolting a parallel
     rating/history system onto leftovers, they join the normal dish list — which
     means they inherit cook mode, the recipe page, ratings and the week archive
     without any of it being rebuilt. A leftover dinner is a dinner. */
  function adoptLeftover(idea, rec) {
    const id = uid();
    setCandidates((cs) => [
      ...cs,
      {
        id,
        title: rec?.title || idea.title,
        blurb: idea.blurb || "",
        why: idea.uses ? `Uses up ${idea.uses}` : "From your leftovers",
        minutes: idea.minutes,
        spice: 0,
        reaction: "yes",
        note: "",
        fromLeftovers: true,
      },
    ]);
    if (rec) setRecipes((r) => ({ ...r, [id]: { ...rec, basis: shoppingSignature } }));
    setCookingId(id);
    setView("cook");
  }

  /* Clear everything week-specific and start fresh. Profile, favourites and
     history are deliberately kept — those are the things that accumulate. */
  function startNewWeek() {
    prefetchedRef.current = new Set();
    setPrefetching(0);
    setWeekId(null);
    setCandidates([]);
    setEcosystem(null);
    setWeek({});
    setShopping([]);
    setRecipes({});
    setLeftoverIdeas([]);
    setLeftoverRecipes({});
    setThread([]);
    setConvo([]);
    setMiseThread([]);
    setExcluded([]);
    setCookingId(null);
    setDoneSteps({});
    setRecipeChat([]);
    setRecipeOptions([]);
    setHaveOnHand("");
    setThisWeek({ fridge: "", cravings: "", request: "" });
    setCooking(false);
    setCookStep(null);
    setErr("");
    setView("thisweek");
  }

  const persist = useCallback(async (next) => {
    try {
      const payload = {
        profile: next.profile ?? profile,
        favorites: next.favorites ?? favorites,
        savedAt: new Date().toISOString(),
        setupDone: next.setupDone ?? setupDone,
      };
      await apiStorageSet(STORE_KEY, JSON.stringify(payload));
      setSavedAt(payload.savedAt);
      setStorageOk(true);
    } catch (_) {
      setStorageOk(false);
    }
  }, [profile, favorites, setupDone]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => persist({}), 700);
    return () => clearTimeout(t);
  }, [profile, favorites, loaded, persist]);

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const toggleIn = (k, v) =>
    setProfile((p) => {
      const next = p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v];
      /* Nights get tapped in whatever order the finger lands, not calendar order —
         every screen that lists them (setup, My Week, Mise's own context) was
         rendering Sat-before-Tue if that's the order they were picked. Sort
         anything that's a day name back into the week's actual order. */
      return { ...p, [k]: k === "nights" ? DAYS.filter((d) => next.includes(d)) : next };
    });

  /* --------------------------------------------------------- focus on move */

  /* Focus the heading for screen readers, but preventScroll so the browser's own
     focus-scroll doesn't fight the explicit jump below. */
  useEffect(() => {
    try { headingRef.current?.focus({ preventScroll: true }); }
    catch (_) { headingRef.current?.focus(); }
    if (!scrollTarget) jumpTop();
    // eslint-disable-next-line
  }, [view, step]);

  /* Land at the top whenever a screen changes OR a batch of new content arrives —
     otherwise you're left halfway down the previous page reading the middle of
     something new. Both the window and the document element are reset because
     which one actually scrolls depends on how the artifact is framed. */
  function jumpTop() {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    } catch (_) {}
  }

  useEffect(() => {
    if (!scrollTarget) jumpTop();
    // eslint-disable-next-line
  }, [candidates.length, shopping.length, leftoverIdeas.length, thread.length, recipeOptions.length]);

  /* ------------------------------------------------------- prompt context */

  const chosen = useMemo(() => candidates.filter((c) => c.reaction === "yes"), [candidates]);
  const scheduled = useMemo(
    () =>
      /* Object.entries follows insertion order, i.e. whichever day's dropdown you
         filled in first — not calendar order. Sort by DAYS so Cook mode's picker,
         Mise's screen context, and the shopping menu all read Mon-to-Sun. */
      DAYS.filter((d) => week[d])
        .map((day) => [day, week[day]])
        .map(([day, id]) => ({ day, dish: candidates.find((c) => c.id === id) }))
        .filter((x) => x.dish),
    [week, candidates]
  );

  const profileBlock = () => {
    const r = [...profile.restrictions, profile.restrictionsNote].filter(Boolean).join(", ");
    const loved = favorites.filter((f) => f.rating >= 4).map((f) => f.title).slice(-8);
    const flopped = favorites.filter((f) => f.rating <= 2).map((f) => `${f.title} (${f.missing || "didn't land"})`).slice(-6);
    const lessons = favorites.flatMap((f) => (f.missing && f.missing !== "Nailed it" ? [f.missing] : [])).slice(-6);
    const perNight = orderDays(profile.nights).map((d) => `${DAY_FULL[d]} ${countFor(d)}`).join(", ");
    /* Derived from their own diagnoses over time — the difference between an app
       that remembers and one that just stores. Only real patterns appear here. */
    const palate = palateModel(history);
    return `${
      profile.consistent
        ? `COOKS FOR: ${profile.people} ${profile.people === 1 ? "person" : "people"} every night`
        : `HEADCOUNT VARIES BY NIGHT — this is important, treat each night separately:
${perNight || "no nights set"}
Usual number when unspecified: ${profile.people}.
Scale each dish to ITS OWN night's count, not to an average. A night cooking for one has the
package-size problems of cooking for one even if another night feeds four — so a four-person
night is the right place to use up the big pack, and the solo night should lean on what's
already open. Where a bigger night can deliberately cook extra to feed a smaller night later,
say so; that's a feature, not leftovers.`
    }
COOKING NIGHTS: ${orderDays(profile.nights).map((d) => DAY_FULL[d]).join(", ") || "not set"}
TIME PER NIGHT: about ${profile.time} minutes
HEAT LEVEL (ABSOLUTE CEILING): ${SPICE[profile.spice].label} — ${SPICE[profile.spice].note}
RESTRICTIONS AND ALLERGIES (ABSOLUTE): ${r || "none stated"}
DISLIKES: ${profile.dislikes || "none stated"}
${profile.healthConscious ? `HEALTH-CONSCIOUS: they'd like a gentle lean this way — more vegetables, lighter
preparations, roasting or searing over deep-frying, reaching for vegetables/acid/herbs before
cream or extra cheese when a dish needs more, but only where it doesn't cost real flavor or
interest. This is a lean, not a diet: no calorie counting, no forbidden foods, no lecturing.
A genuinely good dish that happens to be lighter is the goal, never a worse dish that's virtuous.` : ""}
ADVENTUROUSNESS: ${ADVENTURE[profile.adventure - 1].label} — ${ADVENTURE[profile.adventure - 1].note}
EQUIPMENT THEY OWN — THIS IS A HARD CONSTRAINT, NOT A PREFERENCE: ${profile.equipment.join(", ") || "nothing specified"}
Every single step must be achievable with ONLY that equipment plus a knife, a board, a bowl and
a can opener. Do not propose a dish that needs anything absent, and do not write a step that
quietly assumes it — "sear in a hot pan", "roast at 400°F", "bring a pot to the boil" are all
forbidden if the corresponding equipment isn't on that list. If the honest answer is that a
dish can't be made with what they have, propose a different dish instead of a compromised
version.${
  !profile.equipment.some((e) => ["Stovetop", "Oven", "Air fryer", "Grill", "Slow cooker", "Rice cooker"].includes(e))
    ? `
SEVERE CONSTRAINT: they have NO stovetop, oven, grill or similar. Everything must genuinely
work in a microwave and with no-cook methods. This rules out most of the usual repertoire —
lean on steamed vegetables and grains, microwave-poached eggs and fish, canned pulses, quick
pickles, no-cook sauces, dressed raw vegetables, tinned fish, wraps and assembled bowls. Make
these genuinely good rather than apologetic; that is the whole job here.`
    : ""
}
${profile.smokeAlarm ? "SENSITIVE SMOKE ALARM: avoid ripping-hot smoky searing when another route gets there." : ""}
ALREADY IN THE KITCHEN: ${thisWeek.fridge || "nothing mentioned"}
CRAVING THIS WEEK: ${thisWeek.cravings || "open"}
${thisWeek.request ? `THEY SPECIFICALLY ASKED TO MAKE: ${thisWeek.request} — include it or a close cousin unless it breaks a restriction or creates real waste, in which case say why and offer the nearest thing that works.` : ""}
${loved.length ? `DISHES THEY RATED HIGHLY BEFORE (lean toward this territory): ${loved.join("; ")}` : ""}
${flopped.length ? `DISHES THAT DIDN'T LAND: ${flopped.join("; ")}` : ""}
${lessons.length ? `RECURRING FEEDBACK — build these in: ${[...new Set(lessons)].join("; ")}` : ""}
${recentTitles.length ? `COOKED IN PREVIOUS WEEKS — when inventing NEW suggestions, steer away from these and their near-variants so the weeks don't blur together:
${recentTitles.join("; ")}
This is guidance for generating fresh ideas only. It is NOT a ban list. If one of these is already on their menu, or they ask about it, discuss it normally — never tell someone they "can't" cook something.` : ""}${
      palate.length
        ? `
WHAT THEIR OWN FEEDBACK HAS TAUGHT YOU — act on this, don't narrate it back at them:
${palate.map((x) => `- ${x}`).join("\n")}`
        : ""
    }`;
  };

  /* How many people eat on a given night. */
  const countFor = (day) =>
    profile.consistent ? profile.people : Number(profile.headcount?.[day]) || profile.people;

  /* A recipe should be scaled to the night it's actually cooked on, not to some
     household average — that was the real gap: recipes were always scaled to
     profile.people regardless of who was eating that evening. */
  const servingsFor = (dishId) => {
    const day = DAYS.find((d) => week[d] === dishId);
    return day ? countFor(day) : profile.people;
  };

  const totalCovers = useMemo(
    () => scheduled.reduce((sum, s) => sum + countFor(s.day), 0),
    // eslint-disable-next-line
    [scheduled, profile.consistent, profile.people, profile.headcount]
  );

  /* Quantities count too: changing "500g chicken" to "1kg chicken" should mark the
     recipes stale just as surely as removing the chicken would. Including qty means
     any ingredient adjustment anywhere immediately flags every affected recipe. */
  /* The doctrine can teach variety in principle, but only the app knows what was
     actually put in front of this person the last few weeks. Without this, every
     week starts from a blank slate and drifts back to the same handful of dishes. */
  /* PAST weeks only. Including the current week's candidates meant the dishes
     showing on screen were listed as "already done", so Mise refused to discuss
     the very things the person had just picked. Only archived weeks count. */
  const recentTitles = useMemo(() => {
    const currentWeek = new Set(candidates.map((c) => (c.title || "").toLowerCase()));
    return [...new Set(history.flatMap((w) => (w.dishes || []).map((d) => d.title)))]
      .filter((t) => t && !currentWeek.has(t.toLowerCase()))
      .slice(-24);
  }, [history, candidates]);

  const shoppingSignature = useMemo(
    () =>
      shopping
        .map((i) => `${(i.item || "").trim().toLowerCase()}@${(i.qty || "").trim().toLowerCase()}`)
        .sort()
        .join("|"),
    [shopping]
  );

  /* How many written recipes no longer match the current list. Surfaced in the nav
     so an edit on the Shopping screen is visible from anywhere. */
  const staleRecipeCount = useMemo(
    () =>
      Object.values(recipes).filter((r) => r?.basis && r.basis !== shoppingSignature).length,
    [recipes, shoppingSignature]
  );

  /* Write the recipes ahead of time so the Cook screen is already populated when
     you get there. Deliberately waits for the shopping list: a recipe generated
     before it exists doesn't know the night's headcount or what's actually being
     bought, and would be flagged stale the moment the list landed. One at a time,
     quietly, so it never competes with whatever you're doing on screen. */
  const prefetchedRef = useRef(new Set());
  const [prefetching, setPrefetching] = useState(0);

  useEffect(() => {
    if (!shopping.length) return;
    // Background work must never compete with something the person is waiting on —
    // three prefetches firing during a foreground request is why everything felt
    // slow at once. Hold off until the foreground is idle.
    if (busy) return;
    /* Scheduled dishes first (they carry a night, so they scale correctly), then
       any other picked dish. Iterating only `scheduled` meant that if you built a
       shopping list without assigning days — now the common path — nothing was
       prefetched at all and Cooking started cold. */
    const ids = [
      ...scheduled.map((s) => s.dish.id),
      ...chosen.map((c) => c.id),
    ];
    const pending = [...new Set(ids)].filter(
      (id) => !recipes[id] && !prefetchedRef.current.has(id)
    );
    if (!pending.length) {
      setPrefetching(0);
      return;
    }
    /* One at a time, in the background. Firing all three at once was quick when it
       worked, but three simultaneous calls plus whatever the person is actively
       doing is enough to hit a rate limit — which surfaced as "couldn't reach the
       kitchen" on their foreground request, not on the invisible background one.
       They still start the moment the shopping list lands, which is the point. */
    let cancelled = false;
    pending.forEach((id) => prefetchedRef.current.add(id));
    setPrefetching(pending.length);

    (async () => {
      for (const id of pending) {
        if (cancelled) return;
        try {
          await getRecipe(id, { quiet: true });
        } catch (_) {
          prefetchedRef.current.delete(id);   // retried on demand if it failed
        } finally {
          if (!cancelled) setPrefetching((n) => Math.max(0, n - 1));
        }
        await new Promise((r) => setTimeout(r, 400));   // breathing room between calls
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [shopping.length, busy, scheduled.map((s) => s.dish.id).join(","),
      chosen.map((c) => c.id).join(","), Object.keys(recipes).join(",")]);

  const shoppingBlock = () =>
    shopping.length
      ? shopping.map((i) => `- ${i.qty} ${i.item}${i.have ? " (already has)" : ""}`).join("\n")
      : "(no list built yet — assume a sensible one)";

  /* Mise's blind spot was that she only ever saw the open recipe. She now gets a
     description of whatever is actually on screen, so "which of these should I cook
     first" or "is this too much food" can be answered without you re-explaining. */
  const screenContext = () => {
    if (cooking && recipes[cookingId]) {
      const rec = recipes[cookingId];
      return `SCREEN: cooking mode, actively at the stove.
DISH: ${rec.title} (${rec.servings || "?"}, ${rec.time || "?"})
${cookStep != null ? `ON STEP ${cookStep + 1} OF ${(rec.steps || []).length}: "${(rec.steps || [])[cookStep]?.do || ""}"` : "In the mise en place stage, not started cooking."}
INGREDIENTS: ${(rec.components || []).map((c) => (c.items || []).join("; ")).join(" | ")}`;
    }

    switch (view) {
      case "ideas":
        return `SCREEN: browsing dish ideas.
${ecosystem ? `THIS WEEK'S SPINE: ${[ecosystem.aromatics, ecosystem.protein, ecosystem.vegetable, ecosystem.flavorSystem, ecosystem.wildcard].filter(Boolean).join(", ")}` : ""}
CANDIDATES ON SCREEN:
${candidates.map((c) => `- ${c.title}${c.reaction === "yes" ? " [PICKED]" : c.reaction === "no" ? " [rejected]" : ""}${c.note ? ` (they said: ${c.note})` : ""} — ${c.blurb}`).join("\n") || "none yet"}`;

      case "week":
        return `SCREEN: assigning dishes to nights.
${scheduled.map((x) => `- ${DAY_FULL[x.day]}: ${x.dish.title}${profile.consistent ? "" : ` (feeding ${countFor(x.day)})`} — ${x.dish.blurb}`).join("\n") || "nothing assigned yet"}
PICKED BUT NOT YET ON A DAY: ${chosen.filter((c) => !Object.values(week).includes(c.id)).map((c) => c.title).join(", ") || "none"}
If they ask about order, reason about what spoils first, what makes leftovers the next dish can use, and which night has least time.`;

      case "shop":
        return `SCREEN: the shopping list.
${shopping.length} items, ${shopping.filter((i) => !i.checked && !i.have).length} still to buy.
LIST: ${shopping.map((i) => `${i.qty} ${i.item} (~${i.days}d)`).join("; ")}
${excluded.length ? `THEY REMOVED: ${excluded.join(", ")}` : ""}`;

      case "cook": {
        const rec = recipes[cookingId];
        return rec
          ? `SCREEN: reading the recipe for ${rec.title}, not cooking yet.
INGREDIENTS: ${(rec.components || []).map((c) => (c.items || []).join("; ")).join(" | ")}`
          : `SCREEN: the cooking tab, no recipe open yet.`;
      }

      case "leftovers":
        return `SCREEN: leftovers.
WHAT THEY HAVE: ${haveOnHand || "nothing typed yet"}
IDEAS SHOWING: ${leftoverIdeas.map((i) => i.title).join(", ") || "none yet"}`;

      case "me":
        return `SCREEN: their saved kitchen and past ratings.
LOVED: ${favorites.filter((f) => f.rating >= 4).map((f) => f.title).join(", ") || "nothing yet"}
DIDN'T LAND: ${favorites.filter((f) => f.rating <= 2).map((f) => `${f.title} (${f.missing || "?"})`).join(", ") || "nothing yet"}`;

      default:
        return `SCREEN: setting up their kitchen / starting the week. Nothing planned yet.`;
    }
  };

  /* Refresh the cached context whenever the profile actually changes. A change
     costs one cache write; leaving it in the message cost full price on every call. */
  useEffect(() => {
    SESSION_CONTEXT = profileBlock();
    // eslint-disable-next-line
  });

  const menuBlock = () =>
    scheduled.length
      ? scheduled.map((s) => `${DAY_FULL[s.day]}: ${s.dish.title} — ${s.dish.blurb}`).join("\n")
      : chosen.map((c) => `${c.title} — ${c.blurb}`).join("\n");

  /* ------------------------------------------------------------ ideas flow */

  async function startIdeas(existingSeed) {
    mark("ideas", true);
    setErr("");
    setBusy("Putting some ideas together");
    setView("ideas");
    setWeekId(uid());  // a fresh id for this run-through, used once it's archived

    /* Drawn in code, before the model sees anything. This is what actually makes
       week twelve different from week one — see the note on the seed above.

       The shape check on existingSeed is not paranoia, it's a fixed bug: this
       was wired up as `onGo={startIdeas}`, so React handed the button's click
       event in as `existingSeed`. Being an object, it was truthy, so it was
       used AS the seed — and `seed.formats.map(...)` below then threw
       "Cannot read properties of undefined (reading 'map')". Because that
       throw happened before the try block, nothing caught it: no error
       surfaced, no request was ever sent, and the screen sat on
       "Putting some ideas together" forever with nothing in the server logs.
       Anything that isn't a real seed is now ignored rather than trusted. */
    const usable = existingSeed && Array.isArray(existingSeed.formats) ? existingSeed : null;
    const seed = usable || drawWeekSeed(profile, history);
    setWeekSeed(seed);

    /* The umami list is filtered against their restrictions BEFORE it reaches the
       prompt. Previously the doctrine named miso and soy as the standard fix for a
       flat dish, and a no-soy user could get it suggested — because a rule saying
       "check the restriction" competes with a list saying "reach for this." A list
       that never contains the excluded item can't lose that argument. */
    /* Family-based, not literal word overlap. The first version of this filter
       checked whether a restriction word appeared literally inside an umami
       item's own words, with a length>3 cutoff — which meant "soy" and "nut"
       (both <=3 letters) were never even checked, and "vegan" has no literal
       ingredient-word match at all. Result: a vegan, no-soy, nut-allergy
       profile filtered out precisely nothing, and the umami list still handed
       the model miso, soy sauce, anchovy, parmesan and cured pork. Caught by
       building a benchmark that actually exercises this code path — a check
       against the CONCEPT a restriction implies is what the earlier version
       was missing, not a bigger word list. */
    const FOOD_FAMILIES = {
      soy: ["soy sauce", "tamari", "miso", "soy"],
      nuts: [], // no nuts appear in this specific list; kept for parity with the app-wide check
      meat: ["pork", "anchovy", "fish sauce"],
      fish: ["anchovy", "fish sauce", "dried shrimp"],
      shellfish: ["dried shrimp"],
      dairy: ["parmesan", "cheese", "butter"],
    };
    const IMPLIES_EXCLUDE = {
      vegan: ["meat", "fish", "shellfish", "dairy"],
      vegetarian: ["meat", "fish", "shellfish"],
      pescatarian: ["meat"],
      "dairy-free": ["dairy"],
      "no soy": ["soy"], "soy-free": ["soy"], "soy allergy": ["soy"],
      "nut allergy": ["nuts"], "no nuts": ["nuts"], "tree nut allergy": ["nuts"],
      "shellfish allergy": ["shellfish"], "no shellfish": ["shellfish"],
    };
    const restrictionText = [...(profile.restrictions || []), profile.restrictionsNote || ""]
      .join(" ; ").toLowerCase();
    const excludedTerms = new Set();
    Object.entries(IMPLIES_EXCLUDE).forEach(([phrase, families]) => {
      if (restrictionText.includes(phrase)) families.forEach((f) => FOOD_FAMILIES[f]?.forEach((t) => excludedTerms.add(t)));
    });
    const dislikeText = (profile.dislikes || "").toLowerCase();

    const umami = ["anchovy or fish sauce", "miso", "soy sauce or tamari", "parmesan or a hard cheese rind",
      "tomato paste cooked out", "caramelised onions", "cured pork", "dried shrimp", "seaweed",
      "roasted garlic", "browned butter", "olives or capers", "a splash of the cooking water"]
      .filter((x) => {
        const low = x.toLowerCase();
        if ([...excludedTerms].some((t) => low.includes(t))) return false;
        // dislikes still get a plain word check — those are simple ingredient
        // names, not restriction categories needing family expansion.
        return !low.split(/[ ,]+/).some((w) => w.length > 2 && dislikeText.includes(w));
      });

    const prompt = `Here is the person you're cooking with:
THIS WEEK'S DRAW — decided already, not up for negotiation:
- Tradition to work from: ${seed.tradition}
- Vegetable that must appear across the week: ${seed.vegetable}
- Technique to teach in passing: ${seed.technique}
- Cooking formats available to you, one per dish, no repeats:
${seed.formats.map((f) => `    · ${f}`).join("\n")}

These were drawn for this week specifically so the weeks don't blur together. Don't ask for a
different tradition and don't quietly drift to a more familiar one — the whole point is that
you wouldn't have picked ${seed.tradition} yourself. Make THIS week good rather than proposing
the week you'd have proposed anyway. If the tradition and their restrictions genuinely can't
meet, say so plainly rather than silently substituting.

If a dish tastes flat, these are the fixes available given their restrictions:
${umami.join(", ")}.

Do three things.

0. FIRST, before any dish, write a one-line constraint card in your own words:
"Cooking for N. Cannot use: [restrictions, allergies, dislikes]. Heat ceiling: X. Can only cook
with: [their equipment]." Then give each dish a "fits" field: (no [restriction], [equipment] only).
Writing the check before the output is the point — a dish that can't be tagged doesn't belong.
"fits" is a private check, never shown to anyone: it MUST NOT appear inside "title", "blurb",
"why" or "say". Do not repeat it in the visible copy in any form.

1. Propose this week's grocery spine: one fresh herb, green onions, one primary protein,
${seed.vegetable} as the vegetable, one flavor system, one optional wildcard. One sentence on
how the pieces cross over.

2. Propose ${Math.max(4, orderDays(profile.nights).length + 2)} CANDIDATE dishes — options to
react to, not a locked plan. Have a favorite and say which in your opening remark. They cook
${orderDays(profile.nights).length} night(s) a week, so there must be at least that many
candidates plus a couple of spares to reject — never fewer than one per night.

No two candidates may share a cuisine, and no two may share a COOKING FORMAT. "Same cuisine"
means the same FLAVOUR WORLD, not the same dish name — a tahini-lemon bowl, an olive-and-herb
pita and a dill-cucumber salad are three different dishes and one single cuisine. Different
titles are not diversity. Check the list against itself before you answer: if two dishes draw
on the same broad flavour tradition, or two are both stir-fries, replace one. AMBITION AND TIME ARE INDEPENDENT. Adventurousness is about the IDEA — an unfamiliar technique,
a pairing they wouldn't have guessed, a familiar dish seen from a new angle. It is not about how
long something takes. Caramelised onions take an hour and are not remotely adventurous; smashing
cucumbers so the ridges catch a dressing takes two minutes and is a genuinely good idea. So high
adventurousness inside a short time limit is NOT a contradiction to flag — it's a brief: be
clever AND be fast. Respect the time ceiling absolutely and put the ambition in the thinking.
The only real conflict is a technique that physically cannot be rushed (a proper braise, a
laminated dough) — don't propose those inside a short window, or say plainly that they need
more time than they have.

Low adventurousness means familiar, well-executed dishes — it does NOT
mean staying inside one cuisine; a roast chicken, a carbonara, a black bean soup and a chicken
schnitzel are all thoroughly familiar and all completely different from each other.

THE SPINE IS A CONSTRAINT, NOT A HEADING. Every dish must be built from the spine you just
named, plus genuine pantry staples (oil, vinegar, salt, pepper, dried spices, flour, rice,
pasta, canned tomatoes, onions, garlic). Introducing a whole new fresh ingredient or a second
protein means the person buys something that appears once and rots — which is the single
problem this whole app exists to solve. If the protein is canned chickpeas, do NOT also
introduce white beans, black beans and potatoes across other dishes: that is three legumes and
a starch bought for one person. At most ONE dish may reach outside the spine, and if it does,
its "why" must say what earns it. Prefer using the spine harder over shopping wider.

Do not put the same distinctive ingredient in more than one dish unless it's the week's shared
protein or vegetable — and specifically, mushrooms should appear in at most one dish. Pasta, a braise, a sheet-pan roast, a quick pan-sear, a
grain bowl, soup, eggs or beans, a handheld, a vegetable-led plate: pick from across that
range. An ordinary format done well is not a lesser suggestion — a great pasta with broccoli
belongs on this list as much as anything with an unusual sauce.

If a step implies a process their equipment cannot perform, say where the ingredient comes from
instead of implying they make it. With only a microwave, "toasted seeds" is not achievable —
write "pre-toasted" or "store-bought toasted" so it's unambiguous, or leave it out. Never let a
dish quietly assume a tool they don't have.

Write in plain, warm language a person of any age can read easily. No jargon without a quick
gloss. ${CHAT_VOICE} That applies to "say". "logic" is one sentence. Each "blurb" and "why" is
14 words or fewer. "spice" is 0-4 and must not exceed their ceiling of ${profile.spice}.

Respond with ONLY this JSON, no backticks:
{"say":"",
"ecosystem":{"aromatics":"the herb-and-aromatic anchor, whatever actually fits — not always cilantro and green onion","protein":"","vegetable":"","flavorSystem":"","wildcard":"","logic":""},
"dishes":[{"title":"","blurb":"what it is","why":"the actual idea — not \u0027healthy\u0027 or \u0027quick\u0027, the specific thing that makes this worth having thought of","fits":"private constraint check, never displayed","spice":0,"minutes":30}]}`;

    try {
      /* The most structured output in the app: an ecosystem block plus one
         object per candidate dish, and the candidate count scales with their
         nights. On the 1000 default this was the call most likely to hit the
         cap and come back as truncated JSON for parseJSON to repair. The
         route caps this at 2200 regardless, so it can't run away. */
      const raw = await callClaude([{ role: "user", content: prompt }], { maxTokens: 1800, docSlices: ["core", "flavor"] });
      const out = parseJSON(raw);
      setEcosystem(out.ecosystem || null);
      setCandidates((out.dishes || []).map((d) => ({ ...cleanDish(d), id: uid(), reaction: null, note: "" })));
      setConvo([{ role: "user", content: prompt }, { role: "assistant", content: raw }]);
      setThread([{ who: "mise", text: out.say || "" }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
      mark("ideas", false);
    }
  }

  /* startIdeas builds a long prompt before its own try block, so anything that
     throws during that construction escapes the catch above entirely. When it
     does, the damage is invisible in the worst way: setBusy and setView have
     already run, so the screen switches to the ideas view and sits on
     "Putting some ideas together" forever, no request is sent, and the server
     logs stay empty because the server was never involved. That is exactly how
     the click-event-as-seed bug presented, and it cost days to find.

     Catching at the call site turns that whole class of failure into a visible
     error with a cleared spinner. Call this, not startIdeas directly. */
  function runIdeas(seed) {
    return startIdeas(seed).catch((e) => {
      console.error("startIdeas failed before the request was sent:", e);
      setErr(e?.message || "Something went wrong putting the ideas together.");
      setBusy("");
      mark("ideas", false);
    });
  }

  async function sendFeedback(text) {
    if (!text.trim()) return;
    setErr("");
    setThread((t) => [...t, { who: "me", text }]);
    setBusy("Rethinking");
    const reactions = candidates
      .filter((c) => c.reaction || c.note)
      .map((c) => `- ${c.title}: ${c.reaction === "yes" ? "YES" : c.reaction === "no" ? "NO" : "unsure"}${c.note ? ` — "${c.note}"` : ""}`)
      .join("\n");

    /* State the whole board explicitly. The full conversation used to be replayed
       on every feedback round, which meant re-sending the original prompt (~1,500
       tokens) and growing from there — but it was only doing one job: reminding
       her what was on the list. Saying so directly does that in ~80 tokens. */
    const board = candidates
      .map((c) => `- ${c.title} (${c.blurb})${c.reaction === "yes" ? " [KEEP]" : c.reaction === "no" ? " [rejected]" : ""}`)
      .join("\n");

    const prompt = `The candidates currently on their screen:
${board || "none"}

Their reactions:
${reactions || "No reactions yet."}

They said: "${text}"

Work WITH this. Don't defend your list. Agree when they're right. Replace anything they turned
down with something in a different direction, considering what's already on the menu. Keep
dishes marked YES untouched.

${CHAT_VOICE} That applies to "say". Each "blurb" and "why" 14 words or fewer.

Respond with ONLY this JSON:
{"say":"","dishes":[{"title":"","blurb":"","why":"the actual idea — not \u0027healthy\u0027 or \u0027quick\u0027, the specific thing that makes this worth having thought of","spice":0,"minutes":30,"keep":true}]}

Return the FULL revised list.`;

    try {
      /* Only the last exchange, not the whole session. Everything that matters is
         already stated above, so replaying the history was paying for the same
         information twice — and growing every round. */
      const recent = convo.slice(-2);
      const msgs = [...recent, { role: "user", content: prompt }];
      const raw = await callClaude(msgs, { docSlices: ["core", "flavor"] });
      const out = parseJSON(raw);
      const prior = new Map(candidates.map((c) => [c.title.toLowerCase(), c]));
      setCandidates(
        (out.dishes || []).map((d) => {
          const old = prior.get((d.title || "").toLowerCase());
          return { ...cleanDish(d), id: old?.id || uid(), reaction: old?.reaction ?? null, note: old?.note || "" };
        })
      );
      setConvo([{ role: "user", content: prompt }, { role: "assistant", content: raw }]);
      setThread((t) => [...t, { who: "mise", text: out.say || "" }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  /* One-tap alternative — no typing required. */
  async function swapDish(id) {
    const dish = candidates.find((c) => c.id === id);
    if (!dish) return;
    setErr("");
    setBusy(`Finding something instead of ${dish.title}`);
    const others = candidates.filter((c) => c.id !== id).map((c) => c.title).join(", ");
    const prompt = `They don't want: ${dish.title} (${dish.blurb})
Still on the menu: ${others || "nothing else yet"}

Offer ONE replacement that fills the same slot but goes a different direction, still using the
week's shared ingredients. If the menu already has something rich and fried, go fresher.

Use a different COOKING FORMAT from the one they turned down and from everything else on the
menu — if they rejected a stir-fry, don't offer another stir-fry with a different sauce. And
don't reach for a dish already listed above as recently suggested.

${CHAT_VOICE} "why" and "blurb" 14 words or fewer, "say" is truly one short sentence.

Respond with ONLY this JSON:
{"title":"","blurb":"","why":"the actual idea — not \u0027healthy\u0027 or \u0027quick\u0027, the specific thing that makes this worth having thought of","spice":0,"minutes":30,"say":"one short sentence on why this instead"}`;
    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { docSlices: ["core", "flavor"] });
      const out = parseJSON(raw);
      setCandidates((cs) => cs.map((c) => (c.id === id ? { ...cleanDish(out), id: c.id, reaction: null, note: "" } : c)));
      if (out.say) setThread((t) => [...t, { who: "mise", text: out.say }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  /* --------------------------------------------------------------- shopping */

  async function buildShopping() {
    mark("shopping", true);
    setErr("");
    setBusy("Checking package sizes and waste");
    setView("shop");
    const prompt = `THE MENU:
${menuBlock()}

Build the grocery list. Before you output it, check: does every perishable get used at least
twice? What's the smallest package the store actually sells? Subtract what they already have.
What's left over on Sunday? Is there a crunchy element in every dinner?

${profile.consistent
  ? `TOTAL SERVINGS TO BUY FOR: ${totalCovers}.`
  : `THE NIGHTS ARE DIFFERENT SIZES — buy for the real total, not nights x usual headcount:
${scheduled.map((s) => `- ${DAY_FULL[s.day]}: ${s.dish.title}, ${countFor(s.day)} ${countFor(s.day) === 1 ? "person" : "people"}`).join("\n")}
TOTAL SERVINGS ACROSS THE WEEK: ${totalCovers}.
Quantities must add up across nights of different sizes — a protein feeding four on Saturday
and one on Tuesday is five servings, and that's often exactly what makes a bigger package
worth buying. Say so when it does.`}

For every item give "days" — roughly how many days it stays good after shopping. Use 2 for
delicate herbs, fish, and mushrooms; 5-7 for chicken and soft greens; 14+ for cabbage, roots,
and citrus; 90 for pantry and frozen.

LENGTH IS A HARD CONSTRAINT — a cut-off list is a broken list. ${CHAT_VOICE} That applies to
"say" — one sentence is plenty here. At most two "flags", under 12 words each. "jobs" is 5
words or fewer. Combine where a real shopper would ("2 limes" not two entries), and keep the
whole list to 20 items or fewer. Items come last on purpose, so if anything is lost it's the
least important line.

Respond with ONLY this JSON:
{"say":"the waste reasoning, any tradeoff you made, what's left on Sunday",
"flags":["specific package-size or waste risks"],
"items":[{"item":"","qty":"amount to buy in the units the store sells","section":"Produce|Protein|Dairy & eggs|Bakery|Pantry|Frozen|Other","jobs":"which dishes use it","days":7}]}`;
    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { docSlices: ["core", "groceries"] });
      let repaired = false;
      const out = parseJSON(raw, () => { repaired = true; });
      setShopping(
        (out.items || []).map((i) => ({
          ...i,
          section: normalizeSection(i.section),
          days: Number(i.days) > 0 ? Number(i.days) : 7,
          id: uid(),
          checked: false,
          have: false,
        }))
      );
      setThread((t) => [
        ...t,
        { who: "mise", text: (out.say || "") + (out.flags?.length ? "\n\n" + out.flags.map((f) => "• " + f).join("\n") : "") },
        ...(repaired
          ? [{ who: "mise", text: "That list ran long and the tail got cut off. Check the bottom of it — tap Rebuild my shopping list if something's missing." }]
          : []),
      ]);

      // This is the moment a week stops being a brainstorm and becomes a real plan.
      /* Every dish they picked, not only the ones with a night assigned.
         Assigning days is optional and mostly skipped, so a scheduled-only
         archive stored an empty menu — which left stashRecipeInHistory nothing
         to write a recipe into, and "Cook this again" regenerating from
         scratch even though the recipe existed in session. */
      const planned = [
        ...scheduled.map((s) => ({ day: s.day, dish: s.dish })),
        ...chosen
          .filter((c) => !scheduled.some((s) => s.dish.id === c.id))
          .map((c) => ({ day: null, dish: c })),
      ];
      /* Merged onto what's already archived rather than replacing it, so
         tapping "Rebuild my shopping list" can't wipe a recipe, rating, note
         or photo that's already been recorded against a dish. */
      const already = historyRef.current.find((w) => w.id === weekId)?.dishes || [];
      const sameDish = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
      archiveWeek({
        ecosystem,
        dishes: [
          ...planned.map((p) => {
            const prev = already.find((d) => sameDish(d.title, p.dish.title));
            return {
              ...(prev || { rating: null, missing: null }),
              day: p.day,
              title: p.dish.title,
              blurb: p.dish.blurb,
              fromLeftovers: !!p.dish.fromLeftovers,
            };
          }),
          // Anything archived that's no longer on the menu — a dish cooked
          // again, an adopted leftover, something already rated — stays.
          ...already.filter((d) => !planned.some((p) => sameDish(d.title, p.dish.title))),
        ],
        shoppingCount: (out.items || []).length,
        people: profile.people,
        spice: profile.spice,
        cravings: thisWeek.cravings || null,
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
      mark("shopping", false);
    }
  }

  async function reviseShopping(instruction) {
    if (!instruction.trim()) return;
    setBusy("Adjusting the list");
    const prompt = `CURRENT LIST:
${shopping.map((i) => `${i.qty} ${i.item} (${i.section}, good ~${i.days} days) — ${i.jobs || ""}`).join("\n")}

They want: "${instruction}"

Make the change. If it would create waste or wreck a dish, say so plainly and offer the
substitute instead of silently complying. Return the FULL revised list.

BE BRIEF. "say" is 2 sentences.

Respond with ONLY this JSON:
{"say":"","items":[{"item":"","qty":"","section":"","jobs":"","days":7}]}`;
    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { docSlices: ["core", "groceries"] });
      const out = parseJSON(raw);
      if (out.items)
        setShopping(
          out.items.map((i) => ({
            ...i,
            section: normalizeSection(i.section),
            days: Number(i.days) > 0 ? Number(i.days) : 7,
            id: uid(),
            checked: false,
            have: false,
          }))
        );
      if (out.say) setThread((t) => [...t, { who: "mise", text: out.say }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  /* ---------------------------------------------------------------- recipes */

  async function getRecipe(dishId, opts = {}) {
    const dish = candidates.find((c) => c.id === dishId);
    if (!dish) return;   // must precede mark(), or the flag sticks on forever
    if (!opts.quiet) {
      mark("recipe", dishId);
      setBusy(`Writing ${dish.title}`);
      setErr("");
    }
    const prompt = `Write the recipe for: ${dish.title} — ${dish.blurb} (${dish.why})
${opts.extra || ""}

${shopping.length ? `WHAT THEY ARE ACTUALLY BUYING THIS WEEK — build the recipe from this:
${shoppingBlock()}

Stay inside that list plus obvious pantry staples (salt, pepper, cooking oil, water, sugar,
vinegar, basic dried spices). Do NOT call for a shop-bought ingredient that isn't on the list.
If this dish genuinely needs something absent, put it in "missing" and write the recipe so it
still works without it — don't quietly assume they have it.` : ""}
${excluded.length ? `THEY DELIBERATELY REMOVED THESE FROM THE LIST — work around them, do not reintroduce them: ${excluded.join(", ")}.` : ""}

Scale to ${servingsFor(dishId)} ${servingsFor(dishId) === 1 ? "serving" : "servings"}${
      profile.consistent ? "" : ` — that's how many people eat on the night this dish is cooked${
        DAYS.find((d) => week[d] === dishId) ? ` (${DAY_FULL[DAYS.find((d) => week[d] === dishId)]})` : ""
      }, not the household's usual number`
    }. State that count in "servings".

Scaling isn't just multiplication. A bigger sheet-pan roast needs a bigger pan or a longer time,
not more crowding in the same one; a bigger braise doesn't reduce in proportionally more time;
salt and aromatics scale a little under linearly, not 1:1. Think about what this specific dish
actually needs at this specific count rather than just multiplying the two-person version.

Before you write a single step, re-read the equipment constraint above. Every step must be
possible with only what they own. Respect the heat ceiling and the smoke constraint too.
Write for someone who may be a confident cook or a nervous one: plain words, name what to
look, smell, and feel for, and explain WHY a step matters only when it changes the outcome
("don't move the chicken for two minutes — you're building browning, not just cooking it").

All temperatures in Fahrenheit — oven settings and internal temperatures alike.

Season inside the steps where it happens — never only at the end. Ingredient lines carry their
prep state ("bone-in, skin on, patted dry"), not just a quantity. Where doneness matters, give
the sensory cue first and the temperature second. Every duration needs the thing to look for
next to it.

LENGTH: up to 12 steps, each "do" 40 words or fewer. Use the room for seasoning points and
doneness cues rather than more steps. "why" on at most four steps.

Respond with ONLY this JSON:
{"title":"","servings":"","time":"","technique":"the one technique worth learning here, or empty","seasoning":"what to taste for at the end and how to correct it — flat, thin, harsh, dull","doneness":"the sensory cue and the temperature, or empty if nothing needs judging","assembly":"one sentence","missing":["anything needed that is not on their shopping list, or empty"],"components":[{"name":"","items":["quantity + ingredient WITH its prep state"]}],"steps":[{"do":"","why":""}]}`;
    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { maxTokens: 1900, docSlices: ["core", "flavor"] });
      const built = { ...parseJSON(raw), basis: shoppingSignature };
      setRecipes((r) => ({ ...r, [dishId]: built }));
      /* Bake it into the archived week straight away, rather than waiting for a
         rating. Previously the recipe only reached history via saveRating — so
         a dish you cooked but never rated had nothing stored, and "Cook this
         again" silently regenerated a brand new recipe instead of reopening
         the one you actually made. */
      stashRecipeInHistory(dishId, built);
    } catch (e) {
      if (!opts.quiet) setErr(e.message);   // a failed prefetch retries on demand
      throw e;
    } finally {
      if (!opts.quiet) {
        setBusy("");
        mark("recipe", null);
      }
    }
  }

  /* Stage one: she proposes. "No buns" comes back as two or three real options with
     tradeoffs, not a silent rewrite — because the interesting answer to "no buns" is
     usually a different dish, not the same dish minus bread. */
  async function proposeRecipeChange(instruction) {
    if (!instruction.trim() || !cookingId) return;
    setNegotiating(true);
    setBusy("Thinking it through");
    setErr("");
    setRecipeChat((c) => [...c, { who: "me", text: instruction }]);
    setRecipeOptions([]);

    const rec = recipes[cookingId];
    const prompt = `CURRENT RECIPE:
${JSON.stringify(forPrompt(rec))}

${shopping.length ? `WHAT THEY ARE BUYING:\n${shoppingBlock()}` : ""}

They said: "${instruction}"

Do NOT rewrite the recipe yet. Respond as a chef talking it over: react honestly in one or two
sentences, then offer 2 or 3 genuinely different ways to go, each with what changes and what it
costs them. Have a favourite and mark it.

The good answer to "I don't want to buy buns" is usually a DIFFERENT DISH built from the same
components — a rice bowl, lettuce cups, a different vehicle entirely — not the same sandwich
minus bread. Think about whether the change ruins the dish's structure, and say so if it does.

${CHAT_VOICE} That applies to "say" — react like you would out loud, not like a memo. Each
"what" and "cost" 14 words or fewer.

Respond with ONLY this JSON:
{"say":"your honest reaction, one short sentence",
"options":[{"label":"short name for this route","what":"what changes","cost":"what it costs or gives up","best":false}]}`;

    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { docSlices: ["core", "flavor"] });
      const out = parseJSON(raw);
      setRecipeChat((c) => [...c, { who: "mise", text: out.say || "" }]);
      setRecipeOptions((out.options || []).map((o) => ({ ...o, id: uid() })));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
      setNegotiating(false);
    }
  }

  /* Stage two: you picked one, now she rewrites. */
  async function applyRecipeChange(option) {
    if (!cookingId) return;
    setNegotiating(true);
    setBusy(`Reworking it — ${option.label}`);
    setErr("");
    setRecipeOptions([]);
    setRecipeChat((c) => [...c, { who: "me", text: `Let's do: ${option.label}` }]);

    const rec = recipes[cookingId];
    const prompt = `CURRENT RECIPE:
${JSON.stringify(forPrompt(rec))}

${shopping.length ? `WHAT THEY ARE BUYING:\n${shoppingBlock()}\nStay inside this plus basic pantry staples.` : ""}

They chose this route: ${option.label} — ${option.what}

Rewrite the recipe accordingly. If the dish now deserves a different name, rename it. Keep the
same brevity limits: 10 steps max, each "do" 30 words or fewer, "why" on at most three steps.

${CHAT_VOICE} That applies to "say".

Their shopping list must end up matching the new recipe. Return "shoppingAdd" for anything
the rewrite now needs that isn't already on the list, and "shoppingRemove" for anything the
list only held for the old version and nothing else uses. Leave both empty if nothing changed.

Respond with ONLY this JSON:
{"say":"one short sentence on what you changed",
"shoppingAdd":[{"item":"","qty":"","section":"Produce|Protein|Dairy & eggs|Bakery|Pantry|Frozen|Other","days":7}],
"shoppingRemove":["exact item name from their list"],
"recipe":{"title":"","servings":"","time":"","technique":"","seasoning":"","assembly":"","missing":[],"components":[{"name":"","items":[""]}],"steps":[{"do":"","why":""}]}}`;

    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { maxTokens: 1900, docSlices: ["core", "groceries", "flavor"] });
      const out = parseJSON(raw);

      /* Apply the list changes first, then stamp the recipe against the resulting
         list — otherwise the recipe is immediately "stale" against a list its own
         rewrite just changed. */
      const adds = (out.shoppingAdd || []).filter((a) => a?.item);
      const removes = (out.shoppingRemove || []).map((x) => String(x).toLowerCase());
      /* Computed synchronously from current state rather than inside a setShopping
         updater — an updater runs later, so the signature read below would still be
         the old one and the recipe would be stamped stale against its own change. */
      let nextSignature = shoppingSignature;

      if (adds.length || removes.length) {
        const kept = shopping.filter((i) => !removes.includes((i.item || "").toLowerCase()));
        const fresh = adds
          .filter((a) => !kept.some((i) => (i.item || "").toLowerCase() === a.item.toLowerCase()))
          .map((a) => ({
            ...a,
            section: normalizeSection(a.section),
            days: Number(a.days) > 0 ? Number(a.days) : 7,
            jobs: "Added with a recipe change",
            id: uid(),
            checked: false,
            have: false,
          }));
        const merged = [...kept, ...fresh];
        nextSignature = merged
          .map((i) => `${(i.item || "").trim().toLowerCase()}@${(i.qty || "").trim().toLowerCase()}`)
          .sort()
          .join("|");
        setShopping(merged);
      }

      if (out.recipe) {
        const revised = { ...out.recipe, basis: nextSignature };
        setRecipes((r) => ({ ...r, [cookingId]: revised }));
        // A negotiated rewrite ("make it milder") is the version they actually
        // cooked, so it should replace what's stored — otherwise Cook Again
        // would hand back the pre-negotiation recipe.
        stashRecipeInHistory(cookingId, revised, true);
      }
      if (out.say) setRecipeChat((c) => [...c, { who: "mise", text: out.say }]);
      if (adds.length || removes.length) {
        setRecipeChat((c) => [
          ...c,
          {
            who: "mise",
            text: [
              adds.length ? `Added to your list: ${adds.map((a) => a.item).join(", ")}.` : "",
              removes.length ? `Took off: ${out.shoppingRemove.join(", ")}.` : "",
            ].filter(Boolean).join(" "),
          },
        ]);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
      setNegotiating(false);
    }
  }


  /* -------------------------------------------------------------- leftovers */

  async function getLeftoverIdeas(focusItems = null) {
    mark("leftovers", true);
    setErr("");
    setBusy("Thinking about what that could become");

    const items = parseLeftovers(haveOnHand);
    const target = focusItems && focusItems.length ? focusItems : items;
    const plannedExtras = scheduled.map((s) => s.dish.title).join(", ");

    const itemBlock = target.length
      ? target.map((x, i) => `${i + 1}. ${x}`).join("\n")
      : "(nothing typed in — infer from the week's menu)";

    const prompt = `WHAT THEY ACTUALLY HAVE LEFT — these exact items:
${itemBlock}
${plannedExtras ? `THIS WEEK THEY COOKED: ${plannedExtras}` : ""}

THIS IS THE WHOLE POINT: every idea must actually use something from that numbered list. An
idea that ignores their list is useless to them, however good the dish is. Between the five
ideas, cover EVERY numbered item at least once. If one item genuinely can't be worked in, say
which and why in "orphans" rather than quietly dropping it.

For each idea, "usesItems" must be an array copying the exact item text from the numbered list
above — not a paraphrase, not a new ingredient you're introducing.

Turn these into a NEW meal, not a reheated plate. Range them: at least one under 15 minutes,
at least one proper dinner, at least one breakfast or lunch. Prefer ideas needing nothing extra.

SAFETY — state what genuinely applies, briefly, without lecturing: cooked food keeps three to
four days refrigerated; reheat to steaming right through, not warm at the edges; reheat a
portion once rather than the whole batch repeatedly. Cooked rice is the strict one — a day at
most, steaming hot when reheated, and thrown out if it sat at room temperature overnight. If
something they listed sounds close to the end of its life, say so and put the idea that uses
it up first.
${focusItems && focusItems.length ? "\nThese specific items went unused last time. Build around them." : ""}

BE BRIEF: "blurb" 16 words or fewer, "need" 8 words or fewer.

Respond with ONLY this JSON:
{"say":"2 sentences on the best move here",
"safety":"any handling or use-by warning that genuinely applies to what they listed, or empty",
"orphans":"any listed item nothing can use, and why — or empty",
"ideas":[{"title":"","blurb":"what it is and why it works","usesItems":["exact text from the list"],"need":"anything to buy, or empty","minutes":15}]}`;

    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { docSlices: ["core", "groceries", "flavor"] });
      const out = parseJSON(raw);
      let ideas = (out.ideas || []).map((i) => ({ ...i, id: uid() }));

      /* Enforce it rather than trusting it. An idea using nothing they typed gets
         flagged in the UI, and anything left uncovered is surfaced with a way to
         ask again — the model asserting coverage isn't the same as coverage. */
      if (items.length) {
        ideas = ideas.map((i) => ({
          ...i,
          matched: items.filter((it) => usesItem(i, it)),
        }));
      }

      setLeftoverIdeas(focusItems && focusItems.length ? (prev) => [...prev, ...ideas] : ideas);
      setLeftoverSafety(out.safety || "");
      if (out.say) setThread((t) => [...t, { who: "mise", text: out.say }]);
      if (out.orphans) setThread((t) => [...t, { who: "mise", text: out.orphans }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
      mark("leftovers", false);
    }
  }


  async function expandLeftover(idea) {
    mark("recipe", idea.id);
    setBusy(`Writing ${idea.title}`);
    const prompt = `They have: ${haveOnHand || "leftovers from this week's menu"}
Write the recipe for: ${idea.title} — ${idea.blurb}

Assume they're working from leftovers, so quantities are approximate — say "about" and tell
them how to judge by eye. 8 steps maximum, each 30 words or fewer.

Respond with ONLY this JSON:
{"title":"","servings":"","time":"","seasoning":"","components":[{"name":"","items":[""]}],"steps":[{"do":"","why":""}]}`;
    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { maxTokens: 1500, docSlices: ["core", "flavor"] });
      setLeftoverRecipes((r) => ({ ...r, [idea.id]: parseJSON(raw) }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
      mark("recipe", null);
    }
  }

  /* ------------------------------------------------------------- sous chef */

  async function askMise(text) {
    if (!text.trim()) return;
    setMiseThread((t) => [...t, { who: "me", text }]);
    setBusy("mise");

    const atStove = cooking && recipes[cookingId];
    const framing = atStove
      ? `You are in SOUS-CHEF MODE. They are standing at the stove and may be flustered. ${CHAT_VOICE}
No planning talk. Answer for the step in front of them and adapt to what's actually happening
in the pan. If something's gone wrong, say how to save it — that's worth a second sentence,
everything else usually isn't.

If they ask whether something is done, give the sensory cue AND the temperature — "juices run
clear and it springs back; 165°F at the thickest part if you've got a thermometer" — never a
duration on its own. Poultry 165°F, pork 145°F then rest, beef 125°F rare / 135°F medium-rare /
145°F medium, fish 125-130°F or when it flakes. Fahrenheit throughout. Guessing at this is the one place being wrong actually hurts
someone, so if you can't tell from what they've told you, ask rather than guess.`
      : `They are mid-planning, looking at the screen described below. Answer the question about
what's actually on their screen — you can see it, so don't ask them to describe it. Be direct
and have an opinion. ${CHAT_VOICE} If they ask what order to cook things, a short list of
nights with a few words each beats a paragraph.`;

    const prompt = `${framing}

WHAT IS ON THEIR SCREEN RIGHT NOW:
${screenContext()}

Recent exchange:
${miseThread.slice(-6).map((m) => `${m.who === "me" ? "Them" : "You"}: ${m.text}`).join("\n")}

They ask: "${text}"

YOU CAN ACTUALLY CHANGE THINGS — don't just describe what they should do, do it. If the answer
involves altering their shopping list, put the changes in "shoppingAdd" and "shoppingRemove"
and they'll be applied for real. If it involves rewriting a recipe, put a short instruction in
"recipeInstruction" and that rewrite will be started. Only fill these in when they've actually
asked for a change — answering a question is not a reason to edit anything. Leave them empty
otherwise, which will be most of the time.

${cookingId ? `The recipe they'd be changing is "${recipes[cookingId]?.title || "the open one"}".` : "No recipe is open, so recipeInstruction won't do anything — say so if they wanted one changed."}

Respond with ONLY this JSON:
{"say":"your reply to them, in your normal voice",
"shoppingAdd":[{"item":"","qty":"","section":"Produce|Protein|Dairy & eggs|Bakery|Pantry|Frozen|Other","days":7}],
"shoppingRemove":["exact item name from their list"],
"recipeInstruction":"a short instruction for rewriting the open recipe, or empty"}`;

    try {
      /* Planning chat gets the cheap tier; at the stove it does not. A weak answer
         while browsing dishes is a mild annoyance, but "is this chicken done" or
         "my pan is smoking" is the one place in this app where being wrong has a
         real cost — that stays on the stronger model. */
      const raw = await callClaude([{ role: "user", content: prompt }], {
        tier: atStove ? "main" : "fast",
        // At the stove this is technique/doneness judgment — flavor doctrine.
        // Away from the stove it's more likely to touch the shopping list —
        // groceries doctrine. Either way it can trigger a recipe rewrite via
        // recipeInstruction, but that's a short instruction handed to
        // applyRecipeChange (which carries its own full doctrine), not a
        // rewrite done here.
        docSlices: atStove ? ["core", "flavor"] : ["core", "groceries"],
      });
      /* If she replies with prose instead of JSON that's still a fine answer —
         show it rather than erroring. Only the actions need structure. */
      let out;
      try { out = parseJSON(raw); } catch (_) { out = { say: raw }; }

      setMiseThread((t) => [...t, { who: "mise", text: out.say || raw }]);

      const adds = (out.shoppingAdd || []).filter((a) => a?.item);
      const removes = (out.shoppingRemove || []).map((x) => String(x).toLowerCase());

      if (adds.length || removes.length) {
        setShopping((s) => {
          const kept = s.filter((i) => !removes.includes((i.item || "").toLowerCase()));
          const fresh = adds
            .filter((a) => !kept.some((i) => (i.item || "").toLowerCase() === a.item.toLowerCase()))
            .map((a) => ({
              ...a,
              section: normalizeSection(a.section),
              days: Number(a.days) > 0 ? Number(a.days) : 7,
              jobs: "Added by Mise",
              id: uid(),
              checked: false,
              have: false,
            }));
          return [...kept, ...fresh];
        });

        // Removing something here is a deliberate exclusion, same as deleting it
        // by hand — she shouldn't quietly reintroduce it in a later recipe.
        if (removes.length) setExcluded((x) => [...new Set([...x, ...out.shoppingRemove])]);

        setMiseThread((t) => [
          ...t,
          {
            who: "mise",
            text: [
              adds.length ? `Added: ${adds.map((a) => a.item).join(", ")}.` : "",
              removes.length ? `Removed: ${out.shoppingRemove.join(", ")}.` : "",
            ].filter(Boolean).join(" "),
          },
        ]);
      }

      // A recipe rewrite is a bigger change, so it goes through the normal
      // propose-then-pick flow rather than silently replacing their recipe.
      if (out.recipeInstruction && cookingId) {
        proposeRecipeChange(out.recipeInstruction);
        setMiseThread((t) => [
          ...t,
          { who: "mise", text: "I've put some options on the recipe — have a look and pick one." },
        ]);
      }
    } catch (_) {
      setMiseThread((t) => [...t, { who: "mise", text: "Lost you for a second. Ask me again." }]);
    } finally {
      setBusy("");
    }
  }


  /* ---------------------------------------------------------------- rating */

  async function saveRating(dishId, rating, missing, note, photos = []) {
    const dish = candidates.find((c) => c.id === dishId);
    if (!dish) return;
    const entry = { id: uid(), title: dish.title, blurb: dish.blurb, rating, missing, note,
      photos: photos.slice(0, 3), date: new Date().toISOString() };
    const next = [...favorites, entry];
    setFavorites(next);
    persist({ favorites: next });

    // Carry the rating back onto this week's archived record, matched by title.
    // Only touch it if a record actually exists — otherwise the fallback empty
    // array would overwrite a real dish list with nothing.
    /* Leftover dishes (and anything else cooked after the list was built) aren't
       in the archived menu, so they'd have been rated into the void. Append them
       instead of only updating matches. */
    /* The recipe actually cooked, baked into the archived record. Without this,
       "cook this again" from History had nothing to reopen and silently generated
       a brand new recipe every time — disconnected from whatever was actually
       made and rated the first time, and free to come out differently. */
    const cookedRecipe = recipes[dishId] || null;

    const archived = history.find((w) => w.id === weekId);
    if (archived) {
      const list = archived.dishes || [];
      /* A dish cooked again is a NEW entry, not an overwrite. Overwriting would
         quietly destroy how it went the first time, which is the whole record. */
      const isRepeat = !!dish.againOf;
      const known = !isRepeat && list.some((d) => d.title === dish.title);
      archiveWeek({
        dishes: known
          ? list.map((d) =>
              d.title === dish.title
                ? { ...d, rating, missing, note, photos: photos.slice(0, 3), recipe: cookedRecipe || d.recipe }
                : d
            )
          : [
              ...list,
              {
                day: null,
                title: dish.title,
                blurb: dish.blurb,
                fromLeftovers: !!dish.fromLeftovers,
                cookedAgain: !!dish.againOf,
                cookedAt: new Date().toISOString(),
                rating,
                missing,
                note,
                photos: photos.slice(0, 3),
                recipe: cookedRecipe,
              },
            ],
      });
    }

    setBusy("Thinking about what happened");
    const prompt = `They cooked ${dish.title} and rated it ${rating} out of 5.
What they said was off: ${missing || "nothing specified"}
Their note: "${note || "none"}"

${CHAT_VOICE} Diagnose it — "missing something" is almost always acid, fat, or texture, so name
which — and say the one thing to change next time. Skip the recap of what they told you. Plain
text, no JSON.`;
    try {
      // Short, low-stakes, summarising a verdict they already formed.
      const raw = await callClaude([{ role: "user", content: prompt }], { tier: "fast", docSlices: ["core", "flavor"] });
      setThread((t) => [...t, { who: "me", text: `${dish.title} — ${rating}/5. ${missing || ""}` }, { who: "mise", text: raw }]);
    } catch (_) {
      /* the rating is saved regardless */
    } finally {
      setBusy("");
    }
  }

  async function suggestLike(fav) {
    setBusy(`Finding dishes like ${fav.title}`);
    setErr("");
    const prompt = `They loved: ${fav.title} — ${fav.blurb || ""} (rated ${fav.rating}/5)

Suggest 3 dishes in the same territory but genuinely different plates — not variations.

${CHAT_VOICE} That applies to "say" — just name the through-line, one short sentence. "blurb"
and "why" 14 words or fewer.

Respond with ONLY this JSON:
{"say":"the through-line, one short sentence","dishes":[{"title":"","blurb":"","why":"the actual idea — not \u0027healthy\u0027 or \u0027quick\u0027, the specific thing that makes this worth having thought of","spice":0,"minutes":30}]}`;
    try {
      const raw = await callClaude([{ role: "user", content: prompt }], { docSlices: ["core", "flavor"] });
      const out = parseJSON(raw);
      setCandidates((cs) => [...cs, ...(out.dishes || []).map((d) => ({ ...cleanDish(d), id: uid(), reaction: null, note: "" }))]);
      setThread((t) => [...t, { who: "mise", text: out.say || "" }]);
      setView("ideas");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  /* --------------------------------------------------------------------- UI */

  if (!loaded)
    return (
      <div className="app">
        <style>{CSS}</style>
        <div className="surface" aria-hidden="true" />
        {/* Echoes the shape of the hero card about to appear, rather than a bare
           spinner floating with nothing around it — consistent with the rest of
           the loading system instead of a one-off exception to it. */}
        <main className="main"><div className="stack">
          <section className="card card--big">
            <div className="hero">
              <div className="hero__mark"><span className="ph" style={{ width: 104, height: 104, borderRadius: "50%", margin: "0 auto" }} /></div>
              <span className="ph" style={{ width: "80%", height: "1.7em", margin: "0 auto .9rem", display: "block" }} />
              <span className="ph" style={{ width: "90%", height: ".9em", margin: "0 auto .4rem", display: "block" }} />
              <span className="ph" style={{ width: "60%", height: ".9em", margin: "0 auto", display: "block" }} />
            </div>
          </section>
        </div></main>
      </div>
    );

  const NAV = [
    ["ideas", "Ideas"],
    ["week", "My Week"],
    ["shop", "Shopping"],
    ["cook", "Cooking"],
    ["leftovers", "Leftovers"],
    ["history", "History"],
  ];

  const useFirst = shopping.filter((i) => Number(i.days) <= 3);

  /* True when the visible screen is already rendering its own progress state. */
  const hasLocalIndicator =
    (view === "shop" && building.shopping && !shopping.length) ||
    (view === "leftovers" && building.leftovers && !leftoverIdeas.length) ||
    (view === "cook" && building.recipe === cookingId && !recipes[cookingId]) ||
    (view === "ideas" && !!busy);

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="surface" aria-hidden="true" />

      {/* Defines the actual distortion used by every glass surface — this is
         what makes it lensing rather than blur. No native web API exposes
         Apple's real Liquid Glass material to a website in any browser, so
         this is the closest real equivalent: genuine optical displacement of
         whatever sits behind the panel, not a static effect painted on top. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="glassDistort" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.010 0.014" numOctaves="2" seed="7" result="n" />
          <feGaussianBlur in="n" stdDeviation="3" result="bn" />
          <feDisplacementMap in="SourceGraphic" in2="bn" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <header className="hdr no-print">
        <div className="hdr__row">
          {/* A real <button>, not a div with a click handler — this way it's
              reachable by keyboard, announced properly, and behaves like the
              control it looks like. */}
          <button
            className="hdr__mark"
            onClick={() => setView("start")}
            aria-label="Mise en place — back to the start"
            title="Back to the start"
          >
            <MiseMark size={42} />
            <div className="hdr__word">
              <span className="hdr__logo">Mise</span>
              <span className="hdr__tag">en place</span>
            </div>
          </button>
          <button
            className={`profile${view === "me" ? " profile--on" : ""}`}
            onClick={() => setView(view === "me" ? "ideas" : "me")}
            aria-label="My Kitchen — your setup and saved dishes"
            title="My Kitchen"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.9" />
              <path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {view !== "start" && (
        <nav className="nav no-print" aria-label="Main sections">
          {NAV.map(([id, label]) => (
            <button
              key={id}
              className={`nav__b${view === id ? " nav__b--on" : ""}`}
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
            >
              {label}
              {id === "cook" && staleRecipeCount > 0 && (
                <span className="nav__dot" title={`${staleRecipeCount} recipe(s) need updating`} />
              )}
            </button>
          ))}
        </nav>
      )}

      {err && (
        <div className="alert no-print" role="alert">
          <p>{err}</p>
          <Btn small variant="ghost" onClick={() => setErr("")}>Close</Btn>
        </div>
      )}

      <main className="main screen">
        <h1 className="sr-focus" ref={headingRef} tabIndex={-1}>
          {view === "start" ? "Welcome" : NAV.find(([id]) => id === view)?.[1] || "Mise"}
        </h1>

        {view === "start" && (
          <Start
            savedAt={savedAt}
            setupDone={setupDone}
            profile={profile}
            onSetup={() => { setView("setup"); setStep(0); }}
            onWeek={() => setView("thisweek")}
          />
        )}

        {view === "setup" && (
          <Setup
            profile={profile}
            set={set}
            toggleIn={toggleIn}
            step={step}
            setStep={setStep}
            onDone={() => {
              // Reaching the end of setup is what actually completes onboarding —
              // not the autosave timer having fired at some point.
              setSetupDone(true);
              persist({ setupDone: true });
              setView("thisweek");
            }}
          />
        )}

        {view === "thisweek" && (
          <ThisWeek
            thisWeek={thisWeek}
            setThisWeek={setThisWeek}
            profile={profile}
            onEdit={() => { setView("setup"); setStep(0); }}
            onGo={() => runIdeas()}
            busy={busy}
          />
        )}

        {view === "ideas" && (
          <Ideas
            thread={thread} candidates={candidates} ecosystem={ecosystem} busy={busy}
            seed={weekSeed}
            onReroll={() => runIdeas(drawWeekSeed(profile, history))}
            setCandidates={setCandidates} onSend={sendFeedback} onSwap={swapDish}
            onNext={() => setView("week")} onStart={() => setView("thisweek")}
            onAskMise={(t) => { setMiseOpen(true); askMise(t); }}
            request={thisWeek.request}
            setRequest={(v) => setThisWeek((w) => ({ ...w, request: v }))}
          />
        )}

        {view === "week" && (
          <WeekView
            profile={profile} chosen={chosen} candidates={candidates} week={week} setWeek={setWeek}
            shopping={shopping} onShop={buildShopping} busy={busy}
            onAskMise={(t) => { setMiseOpen(true); askMise(t); }}
            onCook={(id) => { setCookingId(id); if (!recipes[id]) getRecipe(id); setView("cook"); }}
            onNewWeek={startNewWeek}
            onSuggestOrder={suggestOrder}
            onShareWeek={async () => {
              setBusy("Making your card");
              try {
                const canvas = await renderWeekCard(chosen, ecosystem);
                await shareCanvas(canvas, "my-week.png", "This week I'm cooking");
              } catch (_) {
                setErr("Couldn't make that card.");
              } finally {
                setBusy("");
              }
            }}
            countFor={countFor} totalCovers={totalCovers}
            onCount={(d, delta) =>
              setProfile((pr) => {
                const cur = Number(pr.headcount?.[d]) || pr.people;
                return { ...pr, headcount: { ...pr.headcount, [d]: Math.max(1, Math.min(12, cur + delta)) } };
              })
            }
          />
        )}

        {view === "shop" && (
          <Shop
            shopping={shopping} setShopping={setShopping} busy={busy} useFirst={useFirst}
            building={building.shopping} onRebuild={buildShopping}
            onNext={() => setView("cook")}
            onSwap={(item) => setSwapTarget({ item, mode: "shopping" })}
            onExclude={(name) => setExcluded((x) => (x.includes(name) ? x : [...x, name]))}
            prefetching={prefetching}
            recipesReady={scheduled.length > 0 && scheduled.every((s) => recipes[s.dish.id])}
            onAsk={reviseShopping} onPrint={() => printShoppingList(shopping, profile)}
          />
        )}

        {view === "cook" && (
          <Cook
            candidates={candidates} scheduled={scheduled} chosen={chosen} cookingId={cookingId}
            setCookingId={(id) => { setCookingId(id); if (id && !recipes[id]) getRecipe(id); }}
            recipes={recipes} setRecipes={setRecipes} busy={busy}
            doneSteps={doneSteps} setDoneSteps={setDoneSteps}
            onAsk={proposeRecipeChange} onMise={() => setMiseOpen(true)}
            recipeChat={recipeChat} recipeOptions={recipeOptions} negotiating={negotiating}
            onPickOption={applyRecipeChange}
            onRate={saveRating} onPrint={() => recipes[cookingId] && printRecipe(recipes[cookingId])}
            favorites={favorites} buildingRecipe={building.recipe}
            onSwap={(item) => setSwapTarget({ item, mode: "recipe" })}
            onShare={async () => {
              const dish = candidates.find((c) => c.id === cookingId);
              if (!dish) return;
              // Their own photo if they've rated it with one — that's the version
              // worth sharing, not a generic card.
              const shot = [...favorites].reverse().find(
                (f) => f.title === dish.title && f.photos?.length
              )?.photos?.[0];
              setBusy("Making your card");
              try {
                const canvas = await renderDishCard(dish, recipes[cookingId], shot);
                await shareCanvas(canvas, `${dish.title.replace(/[^\w -]+/g, "").trim() || "dish"}.png`, dish.title);
              } catch (_) {
                setErr("Couldn't make that card.");
              } finally {
                setBusy("");
              }
            }}
            scrollTarget={scrollTarget} onScrolled={() => setScrollTarget(null)}
            prefetching={prefetching}
            onStartCooking={() => setCooking(true)}
            shoppingSignature={shoppingSignature}
            hasList={shopping.length > 0}
            onRewrite={() => getRecipe(cookingId)}
            onAddToList={(names) => {
              setShopping((s) => [
                ...s,
                ...names
                  .filter((n) => n && !s.some((i) => (i.item || "").toLowerCase() === n.toLowerCase()))
                  .map((n) => ({ id: uid(), item: n, qty: "", section: "Other", jobs: "Added by you", days: 7, checked: false, have: false })),
              ]);
              setExcluded((x) => x.filter((n) => !names.some((m) => m.toLowerCase() === n.toLowerCase())));
            }}
          />
        )}

        {view === "leftovers" && (
          <LeftoversView
            haveOnHand={haveOnHand} setHaveOnHand={setHaveOnHand}
            ideas={leftoverIdeas} recipes={leftoverRecipes}
            onGet={() => getLeftoverIdeas()} onExpand={expandLeftover} busy={busy}
            scheduled={scheduled} shopping={shopping}
            building={building.leftovers} buildingRecipe={building.recipe}
            onAdopt={adoptLeftover} safety={leftoverSafety}
          />
        )}

        {view === "history" && (
          <HistoryView
            history={history}
            currentWeekId={weekId}
            storageOk={storageOk}
            onOpenWeek={() => setView("week")}
            onNewWeek={startNewWeek}
            onCookAgain={cookAgain}
            onRateHistory={rateHistoryDish}
            onShareDish={async (d) => {
              setBusy("Making your card");
              try {
                // History entries carry their own photo and baked-in recipe, so a
                // shared card from here is the real thing they cooked.
                const canvas = await renderDishCard(
                  { title: d.title, blurb: d.blurb },
                  d.recipe,
                  d.photos?.[0]
                );
                await shareCanvas(canvas, `${(d.title || "dish").replace(/[^\w -]+/g, "").trim()}.png`, d.title);
              } catch (_) {
                setErr("Couldn't make that card.");
              } finally {
                setBusy("");
              }
            }}
          />
        )}

        {view === "me" && (
          <MyKitchen
            profile={profile} favorites={favorites} savedAt={savedAt}
            onEdit={() => { setView("setup"); setStep(0); }}
            onSuggest={suggestLike}
            onRemove={(id) => {
              const next = favorites.filter((f) => f.id !== id);
              setFavorites(next);
              persist({ favorites: next });
            }}
            onShare={async (f) => {
              setBusy("Making your card");
              try {
                // Favourites store their own photo and note, so the card is the
                // dish they actually cooked rather than a generic render.
                const canvas = await renderDishCard(
                  { title: f.title, blurb: f.note || "" },
                  f.recipe,
                  f.photos?.[0]
                );
                await shareCanvas(canvas, `${(f.title || "dish").replace(/[^\w -]+/g, "").trim()}.png`, f.title);
              } catch (_) {
                setErr("Couldn't make that card.");
              } finally {
                setBusy("");
              }
            }}
            busy={busy}
          />
        )}
      </main>

      {/* The bubble sat on top of the loading bar. Hidden while the global
          indicator is up — you can't ask her anything mid-request anyway, since
          every control is disabled until it returns. */}
      {view !== "start" && !(busy && busy !== "mise" && !hasLocalIndicator) && (
        <button className="fab no-print" onClick={() => setMiseOpen(true)} aria-label="Ask Mise, your sous chef">
          <span className="fab__av"><MiseAvatar mood={busy === "mise" ? "thinking" : "idle"} size={40} /></span>
          <span className="fab__t">Ask Mise</span>
        </button>
      )}

      {cooking && recipes[cookingId] && (
        <CookMode
          rec={recipes[cookingId]}
          dish={candidates.find((c) => c.id === cookingId)}
          servingsNote={[recipes[cookingId].servings, recipes[cookingId].time].filter(Boolean).join(" · ")}
          miseThread={miseThread}
          miseBusy={busy === "mise"}
          onAskMise={(t) => { setMiseOpen(true); askMise(t); }}
          onStep={setCookStep}
          onExit={() => { setCooking(false); setCookStep(null); }}
          onFinish={() => {
            setCooking(false);
            setCookStep(null);
            setScrollTarget("rating");
            setView("cook");
          }}
        />
      )}

      {swapTarget && (
        <SwapDialog
          item={swapTarget.item}
          mode={swapTarget.mode}
          busy={!!busy}
          onCancel={() => setSwapTarget(null)}
          onSubmit={(instruction) => {
            const { mode } = swapTarget;
            setSwapTarget(null);
            if (mode === "shopping") {
              setView("shop");
              reviseShopping(instruction);
            } else {
              proposeRecipeChange(instruction);
              setScrollTarget("negotiate");
            }
          }}
        />
      )}

      {miseOpen && (
        <MisePanel
          thread={miseThread} busy={busy === "mise"} onClose={() => setMiseOpen(false)}
          onAsk={askMise} dish={candidates.find((c) => c.id === cookingId)}
          asks={quickAsksFor(view, cooking && !!recipes[cookingId])}
        />
      )}

      {/* The busybar is the fallback indicator only. When a screen is already
          showing its own skeleton for the work in flight, showing this too meant
          two spinners on screen at once. */}
      {busy && busy !== "mise" && !hasLocalIndicator && (
        <div className="busybar no-print"><Working label={busy} /></div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- START */

/* What a brand-new person sees before a single question gets asked. The value
   here can't be demonstrated with real output — every dish depends on knowing
   their kitchen — so this sells what Mise actually is in her own voice rather
   than faking a sample week. Three screens, one idea each, then straight into
   setup. The button sits in the same fixed spot as the wizard's, so the tap
   target never moves across the whole of onboarding. */
function Intro({ onDone }) {
  const [i, setI] = useState(0);
  const lastScreen = 2;

  const screens = [
    {
      art: (
        <div className="introart">
          <img src="/img/dill.webp" alt="" loading="eager" />
        </div>
      ),
      h: "Nobody needs a whole bunch of dill for one dish.",
      p: "I'm Mise. I help you figure out what to cook this week — and I plan it so the things you buy actually get used up, instead of half a bunch wilting in the drawer.",
    },
    {
      art: <MiseAvatar mood="thinking" size={104} />,
      h: "I'm not a recipe search box.",
      p: "We talk it through. I'll suggest a few dishes worth cooking, you tell me what you think, and I'll change them — swap an ingredient, make one milder, drop the one that doesn't appeal. Nothing is locked in until you say so.",
    },
    {
      art: <MiseAvatar mood="happy" size={104} />,
      h: "First, tell me about your kitchen.",
      p: "A few quick questions — who's eating, what you can't stand, what you actually own to cook with. Every answer changes what I suggest, and I'll show you exactly how before we start.",
    },
  ];

  const s = screens[i];
  const next = () => (i === lastScreen ? onDone() : setI(i + 1));

  return (
    <div className="stack wiz-pad">
      <section className="card card--big stepin" key={i}>
        <div className="hero">
          <div className="hero__mark">{s.art}</div>
          <h1 className="hero__h">{s.h}</h1>
          <p className="hero__sub">{s.p}</p>
        </div>
      </section>

      {/* Dots rather than "step 1 of 3" — this part isn't work to get through,
          so counting it like a form would set the wrong expectation. */}
      <div className="dots" role="group" aria-label={`Screen ${i + 1} of ${screens.length}`}>
        {screens.map((_, n) => (
          <span key={n} className={`dots__d${n === i ? " dots__d--on" : ""}`} aria-hidden="true" />
        ))}
      </div>

      <div className="wizbar">
        <div className="wizbar__in">
          {i > 0 && <Btn variant="ghost" onClick={() => setI(i - 1)}>Back</Btn>}
          <Btn onClick={next} wide={i === 0}>
            {i === lastScreen ? "Set up my kitchen" : "Next"}
          </Btn>
        </div>
        {/* Empty, but it holds the same height as the wizard's caption so the
            button above it doesn't jump when the two phases meet. */}
        <p className="wizbar__cap" aria-hidden="true" />
      </div>
    </div>
  );
}

function Start({ savedAt, setupDone, profile, onSetup, onWeek }) {
  if (!setupDone) return <Intro onDone={onSetup} />;

  return (
    <div className="stack">
      <section className="card card--big">
        <h2>What are we cooking this week?</h2>
        {(
          <>
            {/* A tile grid rather than a bulleted list — same information in
                roughly half the vertical space, and the numbers read at a
                glance instead of needing to be parsed out of sentences.
                Tiles span different widths so the grid packs tightly rather
                than leaving a ragged column of half-empty rows. */}
            <div className="setg">
              <div className="setg__t">
                <span className="setg__k">Cooking for</span>
                <span className="setg__v">{profile.people}</span>
              </div>
              <div className="setg__t">
                <span className="setg__k">Nights</span>
                <span className="setg__v">{orderDays(profile.nights).length || "—"}</span>
              </div>
              <div className="setg__t setg__t--wide">
                <span className="setg__k">Heat</span>
                <span className="setg__v setg__v--sm">{SPICE[profile.spice].label}</span>
              </div>
              <div className="setg__t setg__t--full">
                <span className="setg__k">Your nights</span>
                <span className="setg__v setg__v--sm">
                  {orderDays(profile.nights).map((d) => DAY_FULL[d]).join(", ") || "None set"}
                </span>
              </div>
              <div className={`setg__t${profile.healthConscious ? "" : " setg__t--full"}`}>
                <span className="setg__k">Avoiding</span>
                <span className="setg__v setg__v--sm">
                  {profile.restrictions.length ? profile.restrictions.join(", ") : "Nothing saved"}
                </span>
              </div>
              {profile.healthConscious && (
                <div className="setg__t">
                  <span className="setg__k">Leaning</span>
                  <span className="setg__v setg__v--sm">A bit healthier</span>
                </div>
              )}
            </div>
            <div className="row">
              <Btn onClick={onWeek}>Start this week</Btn>
              <Btn variant="ghost" onClick={onSetup}>Change my setup</Btn>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- SETUP */

const STEPS = ["Who's eating", "When you cook", "How spicy", "How adventurous", "What to avoid", "Your kitchen", "Your kitchen, set up"];

/* Reads their answers back as a few specific observations rather than a generic
   "you're all set". The point is that every line here is only true because of
   what they actually chose — a recap that would read identically for anyone
   isn't worth a screen. */
function recapLines(profile) {
  const lines = [];
  const nights = orderDays(profile.nights);

  if (nights.length) {
    const counts = nights.map((d) => (profile.consistent ? profile.people : profile.headcount?.[d] || profile.people));
    const varies = new Set(counts).size > 1;
    lines.push(
      varies
        ? `Cooking ${nights.length} ${nights.length === 1 ? "night" : "nights"} a week, for a different number of people depending on the night — so I'll scale each one on its own instead of averaging.`
        : `Cooking ${nights.length} ${nights.length === 1 ? "night" : "nights"} a week for ${profile.people} ${profile.people === 1 ? "person" : "people"}.`
    );
  }

  if (profile.people === 1) {
    lines.push("Cooking for one means package sizes are the real problem, not portions — I'll plan so a bunch of herbs gets used up rather than half-thrown-away.");
  }

  const r = [...(profile.restrictions || []), profile.restrictionsNote].filter(Boolean);
  if (r.length) lines.push(`${r.join(", ")} — treated as absolute, never "mostly".`);
  if (profile.dislikes) lines.push(`No ${profile.dislikes}. I won't sneak it in as "you won't taste it".`);

  const eq = profile.equipment || [];
  const noStove = eq.length && !eq.some((e) => /stove|hob|cooktop/i.test(e));
  if (noStove) {
    lines.push("No stovetop, so every step has to work in what you actually own — no recipe that quietly assumes a pan on a burner.");
  } else if (eq.length) {
    lines.push(`Cooking with ${eq.slice(0, 3).join(", ").toLowerCase()}${eq.length > 3 ? " and a few more" : ""} — I'll stay inside that.`);
  }

  lines.push(
    profile.spice === 0
      ? "No chili heat at all — that's a ceiling, not a preference I'll drift past."
      : `Heat up to ${SPICE[profile.spice].label.toLowerCase()}, and no further.`
  );

  const adv = profile.adventure;
  lines.push(
    adv <= 2
      ? "Familiar food, done properly — which still means a different cuisine every night, not the same five dishes."
      : adv >= 4
      ? "You want to be pushed, so expect at least one dish a week you haven't made before."
      : "New but recognizable — things you know the shape of, cooked a way you might not have tried."
  );

  if (profile.healthConscious) lines.push("Leaning a little lighter, without it turning into a diet.");
  if (profile.smokeAlarm) lines.push("Keeping the smoke down — no ripping-hot sears when another route gets there.");

  return lines;
}

function Setup({ profile, set, toggleIn, step, setStep, onDone }) {
  const last = STEPS.length - 1;
  const next = () => (step === last ? onDone() : setStep(step + 1));

  return (
    <div className="stack wiz-pad">
      {/* One segment per step rather than a single filled track — you can see
          at a glance how many are left, not just a proportion, and it matches
          the dot language the intro already uses. The heavy card around it is
          gone too; progress is a quiet status line, not a headline. */}
      <div className="progress" role="group" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        <div className="progress__segs" aria-hidden="true">
          {STEPS.map((_, n) => (
            <span
              key={n}
              className={`progress__seg${n < step ? " progress__seg--done" : ""}${n === step ? " progress__seg--now" : ""}`}
            />
          ))}
        </div>
        <p className="progress__t">
          <span className="progress__n">Step {step + 1} of {STEPS.length}</span>
          <span className="progress__label">{STEPS[step]}</span>
        </p>
      </div>

      {/* key={step} remounts on every step change, which is what actually
          retriggers the entrance animation — without it CSS sees the same
          element and plays nothing. */}
      <section className="card card--big stepin" key={step}>
        {step === 0 && (
          <>
            <h2>How many people are you cooking for?</h2>
            <p className="lead">
              {profile.consistent
                ? "This changes more than portion size."
                : "Your usual number — you'll set each night separately on the next step."}
            </p>
            <div className="stepper">
              <button onClick={() => set("people", Math.max(1, profile.people - 1))} aria-label="Fewer people">−</button>
              <span aria-live="polite">{profile.people}</span>
              <button onClick={() => set("people", Math.min(12, profile.people + 1))} aria-label="More people">+</button>
            </div>
            <p className="hint">
              {!profile.consistent
                ? "I'll scale each night on its own."
                : profile.people === 1
                ? "Cooking for one means package sizes are the real problem. I'll design around them."
                : profile.people <= 4
                ? "At this size, pan capacity and different tastes matter more than package sizes."
                : "This is a make-ahead problem. I'll lean on things that hold."}
            </p>
            <label className="check">
              <input type="checkbox" checked={!profile.consistent} onChange={() => set("consistent", !profile.consistent)} />
              <span>The number changes from night to night</span>
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Which nights will you cook?</h2>
            <p className="lead">Tap the days. You can change this any week.</p>
            <div className="grid-days">
              {DAYS.map((d) => (
                <Chip key={d} active={profile.nights.includes(d)} onClick={() => toggleIn("nights", d)}>
                  {DAY_FULL[d]}
                </Chip>
              ))}
            </div>
            {!profile.consistent && profile.nights.length > 0 && (
              <>
                <h3>How many on each night?</h3>
                <p className="hint">
                  I'll scale each recipe to its own night and buy for the real total.
                </p>
                <div className="counts">
                  {orderDays(profile.nights).map((d) => {
                    const n = Number(profile.headcount?.[d]) || profile.people;
                    const bump = (delta) =>
                      set("headcount", { ...profile.headcount, [d]: Math.max(1, Math.min(12, n + delta)) });
                    return (
                      <div key={d} className="count">
                        <span className="count__day">{DAY_FULL[d]}</span>
                        <div className="count__ctl">
                          <button onClick={() => bump(-1)} aria-label={`Fewer people on ${DAY_FULL[d]}`}>−</button>
                          <span aria-live="polite">{n}</span>
                          <button onClick={() => bump(1)} aria-label={`More people on ${DAY_FULL[d]}`}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <h3>How long do you want to spend?</h3>
            <div className="grid-2">
              {[20, 30, 45, 60, 90].map((m) => (
                <Chip key={m} active={profile.time === m} onClick={() => set("time", m)}>
                  {m} minutes
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>How spicy do you like your food?</h2>
            <p className="lead">I'll never go above this. Pick the one that sounds right.</p>
            <Scale options={SPICE} value={profile.spice} onChange={(v) => set("spice", v)} name="Heat level" />
          </>
        )}

        {step === 3 && (
          <>
            <h2>How adventurous are you feeling?</h2>
            <p className="lead">How far from familiar do you want to go?</p>
            <Scale
              options={ADVENTURE}
              value={profile.adventure}
              onChange={(v) => set("adventure", v)}
              name="Adventurousness"
            />
          </>
        )}

        {step === 4 && (
          <>
            <h2>Anything you can't or won't eat?</h2>
            <p className="lead">Tap all that apply. I treat these as hard rules, not preferences.</p>
            <div className="grid-2">
              {RESTRICTIONS.map((r) => (
                <Chip key={r} active={profile.restrictions.includes(r)} onClick={() => toggleIn("restrictions", r)}>
                  {r}
                </Chip>
              ))}
            </div>
            <div className="field">
              <label htmlFor="rn">Allergies or anything else I must avoid</label>
              <input id="rn" type="text" autoComplete="off" autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={profile.restrictionsNote}
                onChange={(e) => set("restrictionsNote", e.target.value)}
                placeholder="For example: no sesame, no alcohol" />
            </div>
            <div className="field">
              <label htmlFor="dl">Foods you just don't like</label>
              <input id="dl" type="text" autoComplete="off" autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={profile.dislikes}
                onChange={(e) => set("dislikes", e.target.value)}
                placeholder="For example: olives, anything with bones" />
            </div>
            <label className="check">
              <input type="checkbox" checked={profile.healthConscious}
                onChange={() => set("healthConscious", !profile.healthConscious)} />
              <span>I&apos;d like to lean a little healthier</span>
            </label>
          </>
        )}

        {step === 5 && (
          <>
            <h2>What do you have to cook with?</h2>
            <p className="lead">Tap what you own. I won't suggest a recipe that needs something you don't have.</p>
            <div className="grid-2">
              {EQUIPMENT.map((e) => (
                <Chip key={e} active={profile.equipment.includes(e)} onClick={() => toggleIn("equipment", e)}>
                  {e}
                </Chip>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={profile.smokeAlarm} onChange={() => set("smokeAlarm", !profile.smokeAlarm)} />
              <span>My smoke alarm goes off easily — keep the smoke down</span>
            </label>
          </>
        )}

        {step === last && (
          <>
            <h2>Here&apos;s your kitchen</h2>
            <p className="lead">
              All of this comes from what you just told me.
            </p>
            <ul className="kitrecap">
              {recapLines(profile).map((line, i) => (
                <li key={i} className="kitrecap__i" style={{ animationDelay: `${i * 90}ms` }}>
                  {line}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Pinned rather than sitting under the content. Each step is a different
          height — a short scale, a tall equipment grid — so a button placed
          after the content jumped around the screen between steps. Fixed
          position means it's in the same place every time. */}
      <div className="wizbar">
        <div className="wizbar__in">
          {step > 0 && (
            <Btn variant="ghost" onClick={() => setStep(step - 1)}>Back</Btn>
          )}
          <Btn onClick={next} wide={step === 0}>
            {step === last ? "Show me this week" : "Next"}
          </Btn>
        </div>
        <p className="hint hint--save">Your answers are saved for next week.</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- THIS WEEK */

function ThisWeek({ thisWeek, setThisWeek, profile, onEdit, onGo, busy }) {
  const upd = (k, v) => setThisWeek((w) => ({ ...w, [k]: v }));
  return (
    <div className="stack">
      <section className="card card--big">
        <h2>Just this week</h2>
        <p className="lead">All optional. Skip straight to the ideas if you'd rather.</p>

        <div className="field">
          <label htmlFor="fr">What's in the kitchen that needs using up?</label>
          <textarea autoCapitalize="sentences" autoCorrect="on" spellCheck="true" id="fr" rows="2" value={thisWeek.fridge} onChange={(e) => upd("fridge", e.target.value)}
            placeholder="Half a cabbage, some scallions, a tub of gochujang" />
        </div>

        <div className="field">
          <label htmlFor="cr">What sounds good right now?</label>
          <input id="cr" type="text" autoComplete="off" autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={thisWeek.cravings} onChange={(e) => upd("cravings", e.target.value)}
            placeholder="Something crispy. Or noodles." />
        </div>

        <div className="field field--hi">
          <label htmlFor="rq">Is there a dish you already want to make?</label>
          <input id="rq" type="text" autoComplete="off" autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={thisWeek.request} onChange={(e) => upd("request", e.target.value)}
            placeholder="Chicken katsu. Beef stew. My grandmother's rice." />
          <p className="hint">I'll build the week around it, or tell you honestly if it fights the rest of the plan.</p>
        </div>

        <div className="recap">
          <p><strong>Using your saved setup</strong></p>
          <ul>
            <li>{profile.people} {profile.people === 1 ? "person" : "people"}, {orderDays(profile.nights).map((d) => DAY_FULL[d]).join(", ") || "no nights picked"}</li>
            <li>About {profile.time} minutes a night</li>
            <li>Heat: {SPICE[profile.spice].label}</li>
            {profile.healthConscious && <li>Leaning a bit healthier</li>}
            <li>{ADVENTURE[profile.adventure - 1].label}</li>
          </ul>
          <Btn small variant="ghost" onClick={onEdit}>Change my setup</Btn>
        </div>

        <div className="wiz">
          <Btn onClick={onGo} disabled={!profile.nights.length || !!busy} wide>
            {busy ? "Working…" : "Show me some ideas"}
          </Btn>
        </div>
        {!profile.nights.length && <p className="hint">Pick at least one night in your setup first.</p>}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- IDEAS */

function Ideas({ thread, candidates, ecosystem, busy, seed, onReroll, setCandidates, onSend, onSwap, onNext, onStart, request, setRequest, onAskMise }) {
  const [draft, setDraft] = useState("");
  const [openNote, setOpenNote] = useState(null);
  const [ecoOpen, setEcoOpen] = useState(false);
  const react = (id, r) => setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, reaction: c.reaction === r ? null : r } : c)));
  const note = (id, v) => setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, note: v } : c)));
  const inCount = candidates.filter((c) => c.reaction === "yes").length;

  if (!candidates.length && !busy)
    return (
      <Empty title="No ideas yet">
        <p>Tell me about your week and I'll suggest a few dishes to pick from.</p>
        <Btn onClick={onStart}>Start this week</Btn>
      </Empty>
    );

  /* The gap this closes: candidates.length is 0 right up until the moment the
     first batch lands, so without this the whole screen sat blank — no
     ecosystem card, no dishes, nothing — behind the generic bottom spinner
     for however long that first call takes. This is the first real AI-wait
     moment in the entire app; it's the one most worth not leaving empty. */
  if (!candidates.length && busy)
    return (
      <div className="stack">
        <section className="card">
          <h2>Thinking through your week</h2>
          <p className="lead">Working out a spine for the week and a few dishes to react to.</p>
          <DishSkeleton count={5} />
        </section>
      </div>
    );

  return (
    <div className="stack">
      {ecosystem && (
        <section className={`card card--dark${ecoOpen ? "" : " card--dark-shut"}`}>
          {/* The draw, shown rather than hidden. Two reasons: it makes the range
              visible (this is where "where did that come from" happens), and a
              reroll gives a rejection signal the weighting can learn from. */}
          {seed && (
            <div className="seed">
              <div className="seed__art" aria-hidden="true" />
              <div className="seed__row">
                <span className="seed__k">This week&apos;s draw</span>
                <button className="seed__re" onClick={onReroll} disabled={busy}>Draw again</button>
              </div>
              <p className="seed__v">
                <strong>{seed.tradition}</strong> · built around <strong>{seed.vegetable}</strong>
              </p>
              <p className="seed__t">Something to pick up along the way: {seed.technique}.</p>
            </div>
          )}

          <button className="eco__toggle" onClick={() => setEcoOpen((v) => !v)} aria-expanded={ecoOpen}>
            <span>What we&apos;re buying this week</span>
            <span className={`fold__chev${ecoOpen ? " fold__chev--open" : ""}`} aria-hidden="true">▾</span>
          </button>
          {ecoOpen && (
          <>
          <ul className="eco">
            {[["Herbs & aromatics", ecosystem.aromatics], ["Protein", ecosystem.protein],
              ["Vegetable", ecosystem.vegetable], ["Flavour base", ecosystem.flavorSystem], ["Wildcard", ecosystem.wildcard]]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <li key={k}><span>{k}</span><strong>{v}</strong></li>
              ))}
          </ul>
          {ecosystem.logic && <p className="eco__why">{ecosystem.logic}</p>}
          </>
          )}
        </section>
      )}

      {thread.length > 0 && (
        <section className="thread" aria-label="What Mise says">
          {thread.map((m, i) =>
            m.who === "mise" ? (
              <div key={i} className="says">
                <MiseAvatar mood="idle" size={38} />
                <div className="bub bub--mise">
                  <span className="bub__who">Mise</span>
                  <p>{m.text}</p>
                </div>
              </div>
            ) : (
              <div key={i} className="bub bub--me">
                <span className="bub__who">You</span>
                <p>{m.text}</p>
              </div>
            )
          )}
        </section>
      )}

      {busy && <Working label={busy} />}

      <h2 className="sec-h">Pick the ones you want</h2>
      <div className="cards">
        {candidates.map((c) => (
          <article key={c.id} className={`dish dish--${c.reaction || "none"}`}>
            <h3>{c.title}</h3>
            <p className="dish__b">{c.blurb}</p>
            <p className="dish__why">{c.why}</p>
            <p className="dish__meta">
              {c.minutes ? `About ${c.minutes} minutes` : ""}
              {c.minutes && c.spice > 0 ? " · " : ""}
              {c.spice > 0 ? `Heat: ${SPICE[Math.min(4, c.spice)].label.toLowerCase()}` : ""}
            </p>
            <div className="dish__acts">
              <Btn small variant={c.reaction === "yes" ? "good" : "solid"} onClick={() => react(c.id, "yes")}>
                {c.reaction === "yes" ? "Added" : "Add it"}
              </Btn>
              <Btn small variant="ghost" onClick={() => onSwap(c.id)} disabled={!!busy}>
                Something else
              </Btn>
            </div>
            <div className="dish__more">
              <button className="linkish" onClick={() => setOpenNote(openNote === c.id ? null : c.id)}>
                {openNote === c.id ? "Hide" : "Say why"}
              </button>
              <button className="linkish" onClick={() => onAskMise(`Tell me more about ${c.title}. Is it right for me this week?`)}>
                Ask about this
              </button>
            </div>
            {openNote === c.id && (
              <input className="dish__note" value={c.note} onChange={(e) => note(c.id, e.target.value)}
                placeholder="Too heavy for a Tuesday" aria-label={`Why, for ${c.title}`} />
            )}
          </article>
        ))}
      </div>

      <section className="card">
        <h2>Want something specific?</h2>
        <div className="field">
          <label htmlFor="rq2">A dish you'd like to make</label>
          <input id="rq2" type="text" autoComplete="off" autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={request} onChange={(e) => setRequest(e.target.value)}
            placeholder="Chicken katsu" />
        </div>
        <Btn small onClick={() => onSend(`I'd like to make ${request}. Can we fit it in?`)} disabled={!request.trim() || !!busy}>
          Ask about it
        </Btn>
      </section>

      <section className="card card--ask">
        <h2>Or tell me in your own words</h2>
        <p className="hint">Optional. Everything above works with buttons alone.</p>
        <textarea autoCapitalize="sentences" autoCorrect="on" spellCheck="true" rows="2" value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="I like the tostadas but Thursday feels too heavy"
          aria-label="Tell Mise what you think" />
        <div className="row">
          <Btn onClick={() => { onSend(draft); setDraft(""); }} disabled={!draft.trim() || !!busy}>Send</Btn>
        </div>
      </section>

      <div className="wiz">
        <Btn onClick={onNext} disabled={!inCount} wide>
          {inCount ? `Plan my week (${inCount} picked)` : "Add a dish to continue"}
        </Btn>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- WEEK */

function WeekView({ profile, chosen, candidates, week, setWeek, onShop, busy, onCook, shopping, onAskMise, onNewWeek, countFor, onCount, totalCovers, onSuggestOrder, onShareWeek }) {
  if (!chosen.length)
    return <Empty title="Nothing picked yet"><p>Go to Ideas and add the dishes you like.</p></Empty>;

  const filled = Object.values(week).filter(Boolean).length;
  const nights = profile.nights.length ? orderDays(profile.nights) : DAYS;

  return (
    <div className="stack">
      {chosen.length >= 2 && (
        <section className="card card--ask">
          <div className="askmise">
            <MiseAvatar mood={busy ? "thinking" : "idle"} size={46} />
            <div>
              <h2>Not sure about the order?</h2>
              <p className="hint">
                I&apos;ll fill the days in for you — what spoils first, what makes leftovers,
                which night has least time.
              </p>
            </div>
          </div>
          <div className="row">
            <Btn small onClick={onSuggestOrder} disabled={!!busy}>
              {busy ? "Working it out…" : "Sort out my week"}
            </Btn>
            <Btn small variant="ghost" onClick={() => onAskMise("Is this too much food for the week?")} disabled={!!busy}>
              Is this too much food?
            </Btn>
            <Btn small variant="ghost" onClick={onShareWeek} disabled={!!busy}>
              Share this week
            </Btn>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Put your dishes on days</h2>
        <p className="lead">
          Cook the delicate things early — fish and soft herbs won't wait until Saturday.
          {!profile.consistent && ` Each night is scaled to its own headcount — ${totalCovers} servings in total this week.`}
        </p>
        {/* Stated in the UI rather than left to the model to mention: a night can
            legitimately be left empty, or repeat a dish. Not the point of the app,
            but people shouldn't feel obliged to fill every slot with something new. */}
        {chosen.length > 0 && chosen.length < nights.length && (
          <p className="hint">
            You have {chosen.length} {chosen.length === 1 ? "dish" : "dishes"} for {nights.length} nights.
            You can add another, leave a night open, or put the same dish on two nights — plenty of
            these make enough for a second night.
          </p>
        )}
        <div className="nights">
          {nights.map((d) => {
            const dish = candidates.find((c) => c.id === week[d]);
            return (
              <div key={d} className="night">
                <div className="night__hd">
                  <h3>{DAY_FULL[d]}</h3>
                  {!profile.consistent && (
                    <div className="count__ctl count__ctl--sm">
                      <button onClick={() => onCount(d, -1)} aria-label={`Fewer people on ${DAY_FULL[d]}`}>−</button>
                      <span aria-live="polite" title="People eating">{countFor(d)}</span>
                      <button onClick={() => onCount(d, 1)} aria-label={`More people on ${DAY_FULL[d]}`}>+</button>
                    </div>
                  )}
                </div>
                <div className="field">
                  <label htmlFor={`sel-${d}`}>Dish</label>
                  <select id={`sel-${d}`} value={week[d] || ""}
                    onChange={(e) => setWeek((w) => ({ ...w, [d]: e.target.value || null }))}>
                    <option value="">Nothing yet</option>
                    {chosen.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                {dish && (
                  <>
                    <p className="night__b">{dish.blurb}</p>
                    <Btn small variant="ghost" onClick={() => onCook(dish.id)}>Open the recipe</Btn>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="wiz">
        {/* Chosen dishes are enough. Requiring day assignments here meant you could
            see dishes on the Cooking page while Shopping insisted nothing was agreed —
            menuBlock already falls back to the picked list when no days are set. */}
        <Btn onClick={onShop} disabled={!chosen.length || !!busy} wide>
          {busy ? "Working…" : shopping.length ? "Rebuild my shopping list" : "Make my shopping list"}
        </Btn>
      </div>
      {!chosen.length && <p className="hint">Pick at least one dish in Ideas first.</p>}
      {!!chosen.length && !filled && (
        <p className="hint">
          Nothing is on a day yet — I&apos;ll shop for all {chosen.length} picked{" "}
          {chosen.length === 1 ? "dish" : "dishes"}. Assigning days lets me scale each night
          and order them by what spoils first.
        </p>
      )}

      {shopping.length > 0 && (
        <p className="hint hint--center">
          Done with this week?{" "}
          <button className="linkish" onClick={onNewWeek}>Start a new one</button>{" "}
          — this week stays in History.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- SHOP */

function Shop({ shopping, setShopping, busy, onAsk, onPrint, useFirst, building, onRebuild,
  onExclude, onNext, prefetching, recipesReady, onSwap }) {
  const [ask, setAsk] = useState("");
  const [openLine, setOpenLine] = useState(null);
  const upd = (id, k, v) => setShopping((s) => s.map((i) => (i.id === id ? { ...i, [k]: v } : i)));
  const del = (id) => setShopping((s) => s.filter((i) => i.id !== id));
  const add = () => setShopping((s) => [...s, { id: uid(), item: "", qty: "", section: "Other", jobs: "", days: 7, checked: false, have: false }]);

  if (!shopping.length && building)
    return (
      <Skeleton
        title="Building your shopping list"
        note="Checking package sizes, what you already have, and what would go off before you got to it."
        rows={7}
      />
    );

  if (!shopping.length)
    return (
      <Empty title="No list yet">
        <p>Pick your dishes in Ideas, then build the list from My Week — I only shop once the menu is agreed.</p>
      </Empty>
    );

  const groups = SECTIONS.map((sec) => [sec, shopping.filter((i) => i.section === sec)]).filter(([, v]) => v.length);
  const left = shopping.filter((i) => !i.checked && !i.have).length;

  return (
    <div className="stack">
      {useFirst.length > 0 && (
        <section className="card card--warn">
          <h2>Use These First</h2>
          <ul className="usefirst">
            {useFirst.map((i) => (
              <li key={i.id}>
                <strong>{i.item}</strong> — best by {daysFromNow(i.days)} ({i.days} days)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card__head">
          <h2>Shopping List</h2>
          <Btn small variant="ghost" onClick={onPrint}>Print this list</Btn>
        </div>
        <p className="lead">{left} still to buy. Tap any line to change it.</p>

        {groups.map(([sec, items]) => (
          <div key={sec} className="sec">
            <h3>{sec}</h3>
            {items.map((i) => {
              const open = openLine === i.id;
              const done = i.checked || i.have;
              return (
                <div key={i.id} className={`row2${done ? " row2--off" : ""}${open ? " row2--open" : ""}`}>
                  {/* Read-only by default. A shopping list is something you scan in
                      an aisle — the edit fields and actions only appear when you
                      actually want them, which took each item from ~210px to ~56px. */}
                  <label className="row2__tick">
                    <input type="checkbox" checked={i.checked}
                      onChange={() => upd(i.id, "checked", !i.checked)} />
                    <span className="sr">Got {i.item}</span>
                  </label>

                  <button className="row2__face" onClick={() => setOpenLine(open ? null : i.id)}
                    aria-expanded={open}
                    aria-label={`${i.qty} ${i.item}. Tap to edit.`}>
                    <span className="row2__text">
                      {i.qty && <b className="row2__qty">{i.qty}</b>}
                      <span className="row2__name">{i.item}</span>
                    </span>
                    {Number(i.days) <= 3 && !done && <span className="row2__soon">{i.days}d</span>}
                    {i.have && <span className="row2__got">have</span>}
                  </button>

                  {open && (
                    <div className="row2__edit">
                      <div className="row2__fields">
                        <input className="row2__inqty" value={i.qty} placeholder="Amount"
                          onChange={(e) => upd(i.id, "qty", e.target.value)} aria-label="Amount" />
                        <GrowInput className="row2__inname" value={i.item} placeholder="Item"
                          onChange={(e) => upd(i.id, "item", e.target.value)} aria-label="Item name" />
                      </div>
                      {i.jobs && <p className="row2__jobs">For: {i.jobs}</p>}
                      <div className="row2__acts">
                        <button className={`line__have${i.have ? " line__have--on" : ""}`}
                          onClick={() => upd(i.id, "have", !i.have)} aria-pressed={i.have}>
                          Have it
                        </button>
                        <button className="line__swap" onClick={() => onSwap(i.item)} disabled={!!busy}>
                          Swap
                        </button>
                        <button className="line__x" onClick={() => { del(i.id); setOpenLine(null); }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="row">
          <Btn small variant="ghost" onClick={add}>Add an item</Btn>
          <Btn small variant="ghost" onClick={onRebuild} disabled={!!busy}>Rebuild the list</Btn>
        </div>
      </section>

      <section className="card">
        <div className="askmise">
          <MiseAvatar mood={busy ? "thinking" : "idle"} size={46} />
          <div>
            <h2>Want to change something?</h2>
            <p className="hint">
              Ask me for a swap, a smaller amount, or something cheaper — I&apos;ll update the
              recipes to match. Or edit any line above by hand.
            </p>
          </div>
        </div>

        <div className="grid-2">
          {[
            "Something cheaper instead",
            "I can't find one of these",
            "Smaller amounts, less waste",
            "Swap something I don't like",
          ].map((q) => (
            <Chip key={q} onClick={() => onAsk(q)}>{q}</Chip>
          ))}
        </div>

        <div className="field">
          <label htmlFor="sa">Or say it in your own words</label>
          <input id="sa" type="text" autoComplete="off" autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={ask} onChange={(e) => setAsk(e.target.value)}
            placeholder="I don't want a whole bunch of dill"
            onKeyDown={(e) => { if (e.key === "Enter" && ask.trim()) { onAsk(ask); setAsk(""); } }} />
        </div>
        <Btn small onClick={() => { onAsk(ask); setAsk(""); }} disabled={!ask.trim() || !!busy}>Ask Mise</Btn>
      </section>

      <div className="wiz">
        <Btn wide onClick={onNext}>
          {recipesReady ? "Start cooking" : "Go to the recipes"}
        </Btn>
      </div>
      <p className="hint hint--center">
        {prefetching > 0
          ? "I'm writing your recipes now — they'll be ready by the time you've shopped."
          : "Your recipes are written and waiting."}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- COOK */

function Cook({ candidates, scheduled, chosen, cookingId, setCookingId, recipes, setRecipes, busy,
  doneSteps, setDoneSteps, onAsk, onMise, onRate, onPrint, favorites, buildingRecipe, onStartCooking,
  shoppingSignature, onRewrite, onAddToList, hasList, recipeChat, recipeOptions, onPickOption,
  scrollTarget, onScrolled, prefetching, onSwap, negotiating, onShare }) {
  const [ask, setAsk] = useState("");
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [missing, setMissing] = useState("");
  const [note, setNote] = useState("");
  const [openFold, setOpenFold] = useState(null);   // "change" | "rate" | null
  const [photos, setPhotos] = useState([]);
  const [photoErr, setPhotoErr] = useState("");
  const ratingRef = useRef(null);
  const negotiateRef = useRef(null);

  /* The swap buttons sit in the ingredient list but the answer renders in a card
     much further down — so tapping one looked like it did nothing at all. Ask,
     then take the person to where the reply will appear. */
  const askAndShow = (text) => {
    onAsk(text);
    setTimeout(() => {
      negotiateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };
  const rec = recipes[cookingId];

  /* Coming out of cook mode, land on the rating section rather than the top of a
     long recipe the person has just finished cooking from. */
  useEffect(() => {
    const map = { rating: ratingRef, negotiate: negotiateRef };
    const target = map[scrollTarget]?.current;
    if (!target) return;
    const t = setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: scrollTarget === "rating" ? "center" : "start" });
      onScrolled?.();
    }, 140);
    return () => clearTimeout(t);
  }, [scrollTarget, onScrolled, rec]);
  const dish = candidates.find((c) => c.id === cookingId);
  /* Scheduled dishes carry their night; anything else picked (including adopted
     leftovers) still belongs in the list, or a leftover dinner would be
     unreachable the moment any dish had a day assigned. */
  const list = [
    ...scheduled.map((s) => ({ id: s.dish.id, title: s.dish.title, day: s.day })),
    ...chosen
      .filter((c) => !scheduled.some((s) => s.dish.id === c.id))
      .map((c) => ({ id: c.id, title: c.title, fromLeftovers: c.fromLeftovers })),
  ];
  const alreadyRated = favorites.some((f) => f.title === dish?.title);

  if (!list.length)
    return <Empty title="Nothing to cook yet"><p>Pick some dishes in Ideas and I'll write the recipes.</p></Empty>;

  const toggleStep = (i) =>
    setDoneSteps((d) => ({ ...d, [cookingId]: { ...(d[cookingId] || {}), [i]: !(d[cookingId] || {})[i] } }));
  const editRecipe = (patch) => setRecipes((r) => ({ ...r, [cookingId]: { ...rec, ...patch } }));

  return (
    <div className="stack">
      <section className="card">
        <h2>What are you cooking?</h2>
        <div className="grid-2">
          {list.map((l) => (
            <Chip key={l.id} active={cookingId === l.id} onClick={() => setCookingId(l.id)}
              sub={l.day ? DAY_FULL[l.day] : l.fromLeftovers ? "from leftovers" : null}>
              {l.title}
            </Chip>
          ))}
        </div>
      </section>

      {cookingId && !rec && buildingRecipe === cookingId && (
        <Skeleton title={`Writing ${dish?.title || "the recipe"}`} note="Scaling it to your kitchen and your heat level." rows={5} />
      )}

      {rec && (
        <>
          <section className="card">
            <div className="card__head">
              <div>
                <h2>{rec.title}</h2>
                <p className="lead">{rec.servings}{rec.servings && rec.time ? " · " : ""}{rec.time}</p>
              </div>
              <div className="headacts">
                <Btn small variant="ghost" onClick={onPrint}>Print</Btn>
                <Btn small variant="ghost" onClick={onShare}>Share</Btn>
              </div>
            </div>

            <div className="row">
              <Btn variant="hot" onClick={onStartCooking}>Start cooking — guided</Btn>
              <Btn variant="ghost" onClick={onMise}>Just ask Mise</Btn>
              <Btn variant="ghost" onClick={() => setEditing((e) => !e)}>
                {editing ? "Done editing" : "Edit by hand"}
              </Btn>
            </div>

            {hasList && rec.basis && rec.basis !== shoppingSignature && (
              <div className="stale">
                <p>
                  <strong>Your shopping list changed</strong> since I wrote this, so the
                  ingredients below may not match what you're actually buying.
                </p>
                <Btn small onClick={onRewrite} disabled={!!busy}>Rewrite it from the current list</Btn>
              </div>
            )}

            {rec.missing?.length > 0 && (
              <div className="stale stale--warn">
                <p>
                  <strong>Not on your list:</strong> {rec.missing.join(", ")}. The recipe works
                  without them, but they'd make it better.
                </p>
                <Btn small variant="ghost" onClick={() => onAddToList(rec.missing)}>
                  Add {rec.missing.length === 1 ? "it" : "them"} to my list
                </Btn>
              </div>
            )}

            {rec.technique && (
              <div className="learn">
                <h3>Worth learning here</h3>
                <p>{rec.technique}</p>
              </div>
            )}

            {!editing ? (
              <>
                <h3 className="sec-h">What you need</h3>
                {(rec.components || []).map((c, ci) => (
                  <div key={ci} className="comp">
                    {c.name && <h4>{c.name}</h4>}
                    <ul className="comp__l2">
                      {(c.items || []).map((it, ii) => (
                        <li key={ii}>
                          <span>{it}</span>
                          <button className="swap" onClick={() => onSwap(it)}
                            aria-label={`Swap ${it}`}>
                            swap
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div className="sec-head">
                  <h3 className="sec-h">Steps</h3>
                  <span className="hint">{(rec.steps || []).length} steps · swipe →</span>
                </div>
                <ol className="hsteps">
                  {(rec.steps || []).map((s, i) => {
                    const done = (doneSteps[cookingId] || {})[i];
                    return (
                      <li key={i} className={`hstep${done ? " hstep--done" : ""}`}>
                        <div className="hstep__top">
                          <span className="hstep__n">{i + 1}</span>
                          <button className="hstep__tick" onClick={() => toggleStep(i)} aria-pressed={!!done}
                            aria-label={`Step ${i + 1}, ${done ? "done" : "not done"}`}>
                            {done ? "✓ Done" : "Mark done"}
                          </button>
                        </div>
                        <p className="hstep__do">{s.do}</p>
                        {s.why && <p className="hstep__why">{s.why}</p>}
                      </li>
                    );
                  })}
                </ol>

                {rec.doneness && (
                  <p className="note note--done"><strong>How to tell it&apos;s done.</strong> {rec.doneness}</p>
                )}
                {rec.assembly && <p className="note"><strong>Putting it together.</strong> {rec.assembly}</p>}
                {rec.seasoning && <p className="note"><strong>Taste and adjust.</strong> {rec.seasoning}</p>}
              </>
            ) : (
              <div className="edit">
                <div className="field">
                  <label htmlFor="ei">Ingredients — one per line. Leave a blank line to start a new group.</label>
                  <textarea autoCapitalize="sentences" autoCorrect="on" spellCheck="true" id="ei" rows="8"
                    value={(rec.components || []).map((c) => `${c.name}\n${(c.items || []).join("\n")}`).join("\n\n")}
                    onChange={(e) => editRecipe({
                      components: e.target.value.split(/\n\s*\n/).map((b) => {
                        const [name, ...items] = b.split("\n");
                        return { name: name || "", items: items.filter(Boolean) };
                      }),
                    })} />
                </div>
                <div className="field">
                  <label htmlFor="es">Steps — one per line</label>
                  <textarea autoCapitalize="sentences" autoCorrect="on" spellCheck="true" id="es" rows="8" value={(rec.steps || []).map((s) => s.do).join("\n")}
                    onChange={(e) => editRecipe({
                      steps: e.target.value.split("\n").filter((l) => l.trim())
                        .map((l, i) => ({ do: l, why: (rec.steps || [])[i]?.why || "" })),
                    })} />
                </div>
              </div>
            )}
          </section>

          <div ref={negotiateRef} />
          <Fold
            title="Want to change something?"
            note="Swaps, milder, faster — nothing changes until you pick"
            open={openFold === "change" || !!recipeChat?.length || !!recipeOptions?.length || !!negotiating}
            onToggle={() => setOpenFold(openFold === "change" ? null : "change")}
          >

            <div className="grid-2">
              {["Make it milder", "Make it faster", "Fewer pans to wash", "I don't want to buy something"].map((q) => (
                <Chip key={q} onClick={() => askAndShow(q === "I don't want to buy something"
                  ? "There's an ingredient here I don't want to buy just for this. What are my options?"
                  : q)}>{q}</Chip>
              ))}
            </div>

            <div className="field">
              <label htmlFor="ra">Or say it in your own words</label>
              <input id="ra" name="miseRecipeAsk" type="text" inputMode="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={ask} onChange={(e) => setAsk(e.target.value)}
                placeholder="I don't want to buy a pack of buns for one burger"
                onKeyDown={(e) => { if (e.key === "Enter" && ask.trim()) { onAsk(ask); setAsk(""); } }} />
            </div>
            <Btn small onClick={() => { onAsk(ask); setAsk(""); }} disabled={!ask.trim() || !!busy}>Ask Mise</Btn>

            {negotiating && (
              <div className="rchat">
                <div className="says">
                  <MiseAvatar mood="thinking" size={36} />
                  <div className="bub bub--mise bub--wait"><Working label="Working it out" /></div>
                </div>
              </div>
            )}

            {recipeChat?.length > 0 && (
              <div className="rchat">
                {recipeChat.map((m, i) =>
                  m.who === "mise" ? (
                    <div key={i} className="says">
                      <MiseAvatar mood="idle" size={36} />
                      <div className="bub bub--mise"><span className="bub__who">Mise</span><p>{m.text}</p></div>
                    </div>
                  ) : (
                    <div key={i} className="bub bub--me"><span className="bub__who">You</span><p>{m.text}</p></div>
                  )
                )}
              </div>
            )}

            {recipeOptions?.length > 0 && (
              <div className="opts">
                <h3>Pick a route</h3>
                {recipeOptions.map((o) => (
                  <button key={o.id} className={`opt${o.best ? " opt--best" : ""}`}
                    onClick={() => onPickOption(o)} disabled={!!busy}>
                    <span className="opt__lab">
                      {o.label}{o.best && <em> · what I'd do</em>}
                    </span>
                    <span className="opt__what">{o.what}</span>
                    {o.cost && <span className="opt__cost">Trade-off: {o.cost}</span>}
                  </button>
                ))}
              </div>
            )}
          </Fold>

          <div className="later" ref={ratingRef}>
            <span className="later__tab">After you've eaten</span>
          </div>

          <Fold
            tone="card--later"
            title="How was it?"
            note={alreadyRated ? "Rated already — rate it again if it went differently" : "Rate it, add a photo, and I'll learn from it"}
            open={openFold === "rate" || scrollTarget === "rating"}
            onToggle={() => setOpenFold(openFold === "rate" ? null : "rate")}
          >
            <p className="lead">
              {alreadyRated
                ? "You've rated this before. Rate it again if it went differently."
                : "This shapes what I suggest next week."}
            </p>
            <div className="stars" role="radiogroup" aria-label="Rating out of five">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} role="radio" aria-checked={rating === n}
                  aria-label={`${n} out of 5`}
                  className={`star${rating >= n ? " star--on" : ""}`} onClick={() => setRating(n)}>
                  <span aria-hidden="true">★</span>
                </button>
              ))}
            </div>
            <p className="hint">
              {rating === 0 ? "Tap a star." : ["", "Wouldn't make it again", "Not great", "Fine", "Really good", "Make this again"][rating]}
            </p>

            <h3>Anything off about it?</h3>
            <div className="grid-2">
              {MISSING_LABELS.map((m) => (
                <Chip key={m} active={missing === m} onClick={() => setMissing(missing === m ? "" : m)}>{m}</Chip>
              ))}
            </div>

            <div className="field">
              <label htmlFor="rn2">Anything else (optional)</label>
              <input id="rn2" type="text" autoComplete="off" autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="The sauce was the best part" />
            </div>

            <div className="field">
              <label htmlFor="rp" className="shotbtn">
                <span>Add a photo</span>
                <span className="shotbtn__sub">Up to three, saved with your rating</span>
              </label>
              <input id="rp" type="file" accept="image/*" multiple className="sr"
                onChange={async (e) => {
                  setPhotoErr("");
                  const files = Array.from(e.target.files || []).slice(0, 3);
                  try {
                    const shrunk = await Promise.all(files.map((f) => shrinkImage(f)));
                    setPhotos((ps) => [...ps, ...shrunk].slice(0, 3));
                  } catch (err) {
                    setPhotoErr(err.message);
                  }
                  e.target.value = "";
                }} />
              {photoErr && <p className="photo__err">{photoErr}</p>}
            </div>

            {photos.length > 0 && (
              <div className="shots">
                {photos.map((src, i) => (
                  <div key={i} className="shot">
                    <img src={src} alt={`Your photo ${i + 1}`} />
                    <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                      aria-label={`Remove photo ${i + 1}`}>×</button>
                  </div>
                ))}
              </div>
            )}

            <Btn onClick={() => { onRate(cookingId, rating, missing, note, photos); setRating(0); setMissing(""); setNote(""); setPhotos([]); }}
              disabled={!rating || !!busy}>
              Save this
            </Btn>
          </Fold>
        </>
      )}
    </div>
  );
}

/* ====================================================================== COOK MODE */

function CookMode({ rec, dish, onExit, onFinish, onAskMise, miseThread, miseBusy, servingsNote, onStep }) {
  const [phase, setPhase] = useState("prep");     // prep -> steps -> done
  const [idx, setIdx] = useState(0);
  const [prepDone, setPrepDone] = useState({});
  const [autoAdvance, setAutoAdvance] = useState(false);   // deliberately off: see the note by the checkbox
  const [showAll, setShowAll] = useState(false);
  const [alert, setAlert] = useState(null);
  const [miseOpen, setMiseOpen] = useState(false);
  const [miseText, setMiseText] = useState("");
  const scrollRef = useRef(null);
  const voice = useSpeech();
  useWakeLock(true);

  /* Cook mode is its own scroll container, so the page-level scroll reset doesn't
     reach it — every new step was landing wherever the last one left you. */
  const toTop = () => {
    try { scrollRef.current?.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
  };

  const steps = rec.steps || [];
  const step = steps[idx];
  const ingredients = useMemo(
    () => (rec.components || []).flatMap((c) => (c.items || []).map((it) => ({ group: c.name, text: it }))),
    [rec]
  );

  const onTimerDone = useCallback(
    (t) => {
      setAlert({ id: t.id, label: t.label });
      voice.speak(`${t.label} timer is done.`, true);
      if (autoAdvance && t.stepIndex === idx && idx < steps.length - 1) {
        setIdx((i) => Math.min(steps.length - 1, i + 1));
      }
    },
    [voice, autoAdvance, idx, steps.length]
  );

  const { timers, add, adjust, togglePause, restart, remove, clearDone } = useTimers(onTimerDone);
  const [openTimer, setOpenTimer] = useState(null);   // which timer's controls are showing

  const sayStep = useCallback(
    (i, force = false) => {
      const st = steps[i];
      if (!st) return;
      voice.speak(`Step ${i + 1}. ${st.do}${st.why ? ` ${st.why}` : ""}`, force);
    },
    [steps, voice]
  );

  // Read each step as you arrive on it, and tell the app where we are so Mise
  // can answer about the step in front of you rather than the recipe in general.
  useEffect(() => {
    if (phase === "steps") sayStep(idx);
  }, [idx, phase, sayStep]);

  useEffect(() => {
    onStep?.(phase === "steps" ? idx : null);
  }, [idx, phase, onStep]);

  useEffect(() => { toTop(); }, [idx, phase]);

  const dictation = useDictation((text) => onAskMise(text));

  const go = (delta) => {
    const next = idx + delta;
    if (next < 0) return;
    if (next >= steps.length) { setPhase("done"); voice.speak("That's it. Nicely done.", false); return; }
    setIdx(next);
  };

  const durations = step ? parseDurations(`${step.do} ${step.why || ""}`) : [];
  const lastMise = [...(miseThread || [])].reverse().find((m) => m.who === "mise");

  return (
    <div className="cook" role="region" aria-label="Cooking mode" ref={scrollRef}>
      <div className="surface surface--linen" aria-hidden="true" />
      {/* -------- top bar -------- */}
      <div className="cook__top">
        <button className="cook__exit" onClick={() => { voice.stop(); onExit(); }}>Leave</button>
        <div className="cook__title">
          <strong>{rec.title}</strong>
          <span>{servingsNote}</span>
        </div>
        {voice.supported ? (
          <button
            className={`cook__vox${voice.on ? " cook__vox--on" : ""}`}
            onClick={() => { const nv = !voice.on; voice.setOn(nv); if (!nv) voice.stop(); }}
            aria-pressed={voice.on}
          >
            {voice.on ? "Voice on" : "Voice off"}
          </button>
        ) : <span className="cook__vox cook__vox--na">No voice here</span>}
      </div>

      {/* -------- running timers, pinned so they survive navigation -------- */}
      {timers.length > 0 && (
        <div className={`ctimers${openTimer ? " ctimers--open" : ""}`} aria-label="Timers">
          {timers.map((t) => {
            const open = openTimer === t.id;
            return (
              <div key={t.id} className={`ctimer${t.done ? " ctimer--done" : ""}${t.paused ? " ctimer--paused" : ""}${open ? " ctimer--open" : ""}`}>
                <button
                  className="ctimer__face"
                  onClick={() => setOpenTimer(open ? null : t.id)}
                  aria-expanded={open}
                  aria-label={`${t.label} timer, ${t.done ? "finished" : t.paused ? "paused" : clockFmt(t.remaining) + " left"}. Tap for controls.`}
                >
                  <span className="ctimer__clock" aria-live={t.done ? "polite" : "off"}>
                    {t.done ? "Done" : clockFmt(t.remaining)}
                  </span>
                  <span className="ctimer__lab">
                    {t.paused && !t.done ? "paused · " : ""}
                    {t.label}{t.stepIndex != null ? ` · step ${t.stepIndex + 1}` : ""}
                  </span>
                </button>

                {open && (
                  <div className="ctimer__ctl">
                    <button onClick={() => adjust(t.id, -60)} aria-label="Take a minute off">−1m</button>
                    <button onClick={() => adjust(t.id, 60)} aria-label="Add a minute">+1m</button>
                    {!t.done && (
                      <button onClick={() => togglePause(t.id)} aria-label={t.paused ? "Resume" : "Pause"}>
                        {t.paused ? "Resume" : "Pause"}
                      </button>
                    )}
                    <button onClick={() => restart(t.id)} aria-label="Start it again">Restart</button>
                    <button className="ctimer__del" onClick={() => { remove(t.id); setOpenTimer(null); }}
                      aria-label={`Cancel ${t.label} timer`}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
          {timers.some((t) => t.done) && (
            <button className="ctimer__clear" onClick={() => { clearDone(); setAlert(null); }}>Clear finished</button>
          )}
        </div>
      )}

      {alert && (
        <div className="cook__ding" role="alert">
          <p><strong>{alert.label}</strong> is up — go and look at it. The clock is a prompt, not a verdict.</p>
          <div className="cook__ding-acts">
            {/* "It needs another couple of minutes" is the most common response to
                a timer going off, so it shouldn't mean starting a new one. */}
            <button onClick={() => { adjust(alert.id, 120); setAlert(null); }}>+2 more minutes</button>
            <button onClick={() => setAlert(null)}>Got it</button>
          </div>
        </div>
      )}

      {/* -------- prep -------- */}
      {phase === "prep" && (
        <div className="cook__body">
          <p className="cook__kicker">First — mise en place</p>
          <h2 className="cook__h">Everything out, then we cook</h2>
          <p className="cook__lead">
            This is the bit professionals never skip. Five minutes of setting up now is the
            difference between cooking and panicking. Tap each one as it hits the counter.
          </p>
          <ul className="prep">
            {ingredients.map((ing, i) => (
              <li key={i}>
                <button
                  className={`prep__b${prepDone[i] ? " prep__b--on" : ""}`}
                  onClick={() => setPrepDone((d) => ({ ...d, [i]: !d[i] }))}
                  aria-pressed={!!prepDone[i]}
                >
                  <span className="prep__tick" aria-hidden="true">{prepDone[i] ? "✓" : ""}</span>
                  <span>{ing.text}{ing.group ? <em> · {ing.group}</em> : null}</span>
                </button>
              </li>
            ))}
          </ul>
          {/* Pinned rather than parked at the end of the list. Nobody scrolls past
              eight ingredients to find the button, and ticking every one is
              optional — the checklist is an aid, not a gate. */}
          <div className="prepbar">
            <div className="prepbar__in">
              <span className="prepbar__count">
                {Object.values(prepDone).filter(Boolean).length} of {ingredients.length} out
              </span>
              <Btn onClick={() => { setPhase("steps"); setIdx(0); }}>
                Start cooking
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* -------- steps -------- */}
      {phase === "steps" && step && (
        <div className="cook__body">
          <div className="cook__prog">
            <p className="cook__kicker">Step {idx + 1} of {steps.length}</p>
            <div className="cook__bar"><span style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
          </div>

          <p className="cook__step">{step.do}</p>
          {step.why && <p className="cook__why">{step.why}</p>}

          <div className="cook__acts">
            {voice.supported && (
              <button className="cbtn" onClick={() => sayStep(idx, true)}>Read it again</button>
            )}
            {durations.map((d) => (
              <button key={d.seconds} className="cbtn cbtn--hot" onClick={() => add(d.label, d.seconds, idx)}>
                Start {d.label} timer
              </button>
            ))}
            <button className="cbtn" onClick={() => add("5 min", 300, idx)}>+5 min timer</button>
          </div>

          <div className="cook__nav">
            <Btn variant="ghost" onClick={() => go(-1)} disabled={idx === 0}>Back</Btn>
            <Btn onClick={() => go(1)}>{idx === steps.length - 1 ? "Finish" : "Next step"}</Btn>
          </div>

          <div className="cook__opts">
            {/* Off by default on purpose. A timer tells you when to go and look,
                not that the food is ready — advancing automatically teaches cooking
                by clock, which is exactly the habit the recipes try to break. */}
            <label className="cook__check">
              <input type="checkbox" checked={autoAdvance} onChange={() => setAutoAdvance((a) => !a)} />
              <span>
                Move on automatically when a timer ends
                <span className="cook__checknote">Off by default — check the food before you move on.</span>
              </span>
            </label>
            <button className="linkish linkish--light" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Hide all steps" : "See all steps"}
            </button>
          </div>

          {showAll && (
            <ol className="cook__all">
              {steps.map((st, i) => (
                <li key={i} className={i === idx ? "on" : ""}>
                  <button onClick={() => { setIdx(i); setShowAll(false); }}>
                    <span>{i + 1}</span> {st.do}
                  </button>
                </li>
              ))}
            </ol>
          )}

        </div>
      )}

      {/* Mise stays a hovering bubble rather than a card buried at the bottom of the
          step — visible from anywhere, and open it for quick asks or a typed question. */}
      {phase === "steps" && !miseOpen && (
        <button className="cbubble" onClick={() => setMiseOpen(true)}>
          <span className="cbubble__av"><MiseAvatar mood={miseBusy ? "thinking" : "idle"} size={40} /></span>
          <span className="cbubble__t">Stuck? Ask me</span>
        </button>
      )}

      {phase === "steps" && miseOpen && (
        <div className="cask" role="dialog" aria-label="Ask Mise">
          <div className="cask__hd">
            <span className="cask__plate"><MiseAvatar mood={miseBusy ? "thinking" : "idle"} size={38} /></span>
            <div>
              <strong>Mise</strong>
              <span>{miseBusy ? "Thinking…" : `On step ${idx + 1}`}</span>
            </div>
            <button className="cask__x" onClick={() => setMiseOpen(false)} aria-label="Close">Close</button>
          </div>

          {lastMise && <p className="cask__say">{lastMise.text}</p>}

          <div className="cask__qs">
            {QUICK_ASKS.stove.slice(0, 4).map((q) => (
              <button key={q} className="cbtn" onClick={() => onAskMise(q)} disabled={miseBusy}>{q}</button>
            ))}
          </div>

          <div className="cask__foot">
            <label className="sr" htmlFor="cq">Ask your own question</label>
            <input id="cq" name="miseCookAsk" type="text" inputMode="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore autoCapitalize="sentences" autoCorrect="on"
              spellCheck="true" enterKeyHint="send" value={miseText} placeholder="Ask anything…"
              onChange={(e) => setMiseText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && miseText.trim()) { onAskMise(miseText); setMiseText(""); }
              }} />
            <button className="cbtn cbtn--hot"
              onClick={() => { if (miseText.trim()) { onAskMise(miseText); setMiseText(""); } }}
              disabled={!miseText.trim() || miseBusy}>Ask</button>
            {dictation.supported && (
              <button className={`cbtn${dictation.listening ? " cbtn--live" : ""}`}
                onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                aria-label="Speak a question">🎤</button>
            )}
          </div>
        </div>
      )}

      {/* -------- done -------- */}
      {phase === "done" && (
        <div className="cook__body cook__body--mid">
          <div className="cook__done-badge"><MiseAvatar mood="happy" size={88} /></div>
          <p className="cook__kicker">Plates up</p>
          <h2 className="cook__h">That's dinner.</h2>
          <p className="cook__lead">
            You cooked the whole thing. Tell me how it went — a photo and a rating is how I
            learn what to put in front of you next week.
          </p>

          <div className="cook__stats">
            <div className="cook__stat">
              <b>{steps.length}</b>
              <span>steps done</span>
            </div>
            <div className="cook__stat">
              <b>{rec.time || "—"}</b>
              <span>on the clock</span>
            </div>
            {rec.technique && (
              <div className="cook__stat">
                <b>+1</b>
                <span>technique</span>
              </div>
            )}
          </div>

          <div className="cook__nav">
            <Btn wide onClick={() => { voice.stop(); onFinish(); }}>Rate it and add a photo</Btn>
            <Btn variant="ghost" onClick={() => { setPhase("steps"); setIdx(steps.length - 1); }}>Back a step</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- LEFTOVERS */

function LeftoversView({ haveOnHand, setHaveOnHand, ideas, recipes, onGet, onExpand, busy, scheduled, shopping, building, buildingRecipe, onAdopt, safety }) {
  const items = useMemo(() => parseLeftovers(haveOnHand), [haveOnHand]);
  const uncovered = useMemo(
    () => items.filter((it) => !ideas.some((i) => usesItem(i, it))),
    [items, ideas]
  );
  const suggestions = useMemo(() => {
    const fromMenu = scheduled.map((s) => s.dish.title);
    const perishable = shopping.filter((i) => Number(i.days) <= 7).map((i) => i.item);
    return [...new Set([...fromMenu, ...perishable])].slice(0, 10);
  }, [scheduled, shopping]);

  const addQuick = (t) => setHaveOnHand((h) => (h ? `${h}, ${t}` : t));

  return (
    <div className="stack">
      <section className="card card--big">
        <h2>What's left in the fridge?</h2>
        <p className="lead">
          Type whatever you've got — rough amounts are fine. A leftover is a head start on a new
          meal, not the same plate again.
        </p>
        <div className="field">
          <label htmlFor="lo">Leftover ingredients</label>
          <textarea autoCapitalize="sentences" autoCorrect="on" spellCheck="true" id="lo" rows="3" value={haveOnHand} onChange={(e) => setHaveOnHand(e.target.value)}
            placeholder="Two cooked chicken thighs, half a cabbage, cold rice, some cilantro" />
        </div>

        {suggestions.length > 0 && (
          <>
            <h3>Or tap what you have</h3>
            <div className="grid-2">
              {suggestions.map((s) => (
                <Chip key={s} active={haveOnHand.toLowerCase().includes(s.toLowerCase())} onClick={() => addQuick(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </>
        )}

        <div className="wiz">
          <Btn onClick={onGet} disabled={!!busy} wide>
            {busy ? "Working…" : ideas.length ? "Give me different ideas" : "What can I make?"}
          </Btn>
        </div>
      </section>

      {building && ideas.length === 0 && (
        <Skeleton title="Working out what that could become" note="Looking for dishes that actually use what you have." rows={4} />
      )}

      {safety && (
        <section className="card card--warn">
          <h2>Before you start</h2>
          <p>{safety}</p>
        </section>
      )}

      {ideas.length > 0 && uncovered.length > 0 && (
        <section className="card card--warn">
          <h2>Not Used Yet</h2>
          <p>Nothing above uses: <strong>{uncovered.join(", ")}</strong></p>
          <div className="row">
            <Btn small onClick={() => onGet(uncovered)} disabled={!!busy}>
              Find something for {uncovered.length === 1 ? "it" : "these"}
            </Btn>
          </div>
        </section>
      )}

      {ideas.length > 0 && (
        <>
          <h2 className="sec-h">Ideas</h2>
          <div className="stack">
            {ideas.map((i) => {
              const rec = recipes[i.id];
              return (
                <article key={i.id} className="card left">
                  <h3>{i.title}</h3>
                  <p>{i.blurb}</p>
                  <p className="left__meta">
                    {i.minutes ? `About ${i.minutes} minutes` : ""}
                  </p>
                  {(i.matched?.length || i.usesItems?.length) > 0 && (
                    <p className="left__uses">
                      <strong>Uses:</strong> {(i.matched?.length ? i.matched : i.usesItems).join(", ")}
                    </p>
                  )}
                  {items.length > 0 && i.matched && i.matched.length === 0 && (
                    <p className="left__warn">
                      This one doesn't use anything you listed.
                    </p>
                  )}
                  {i.need && <p className="left__need">You'd need: {i.need}</p>}

                  {!rec ? (
                    buildingRecipe === i.id ? (
                      <Working label="Writing it out" />
                    ) : (
                      <Btn small variant="ghost" onClick={() => onExpand(i)} disabled={!!busy}>
                        Show me the recipe
                      </Btn>
                    )
                  ) : (
                    <div className="left__rec">
                      <p className="lead">{rec.servings}{rec.servings && rec.time ? " · " : ""}{rec.time}</p>
                      {(rec.components || []).map((c, ci) => (
                        <div key={ci} className="comp">
                          {c.name && <h4>{c.name}</h4>}
                          <ul>{(c.items || []).map((it, ii) => <li key={ii}>{it}</li>)}</ul>
                        </div>
                      ))}
                      <ol className="steps steps--plain">
                        {(rec.steps || []).map((s, si) => (
                          <li key={si}><p>{s.do}</p>{s.why && <p className="step__why">{s.why}</p>}</li>
                        ))}
                      </ol>
                      {rec.seasoning && <p className="note"><strong>Taste and adjust.</strong> {rec.seasoning}</p>}
                      <div className="row">
                        <Btn small onClick={() => onAdopt(i, rec)}>
                          Cook this
                        </Btn>
                        <span className="hint">Adds it to your week so you can rate it after.</span>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- MY KITCHEN */

/* --------------------------------------------------------------- HISTORY */

/* Rating a dish after the fact, from History. Previously ratings could only be
   captured in the moment on the Cook page — so anything cooked without the app
   open, or rated later, could never be recorded at all. */
function HistoryRate({ dish, onSave, onCancel }) {
  const [rating, setRating] = useState(dish.rating || 0);
  const [missing, setMissing] = useState(dish.missing || "");
  const [note, setNote] = useState(dish.note || "");
  const [photos, setPhotos] = useState(dish.photos || []);
  const [err, setErr] = useState("");

  const addPhoto = async (file) => {
    if (!file) return;
    try {
      const shrunk = await shrinkImage(file, 900, 0.72);
      setPhotos((ps) => [...ps, shrunk].slice(0, 3));
      setErr("");
    } catch (_) {
      setErr("Couldn't read that image.");
    }
  };

  return (
    <div className="histrate">
      <div className="stars" role="radiogroup" aria-label="Rating out of five">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`}
            className={`star${n <= rating ? " star--on" : ""}`} onClick={() => setRating(n)}>★</button>
        ))}
      </div>

      <div className="grid-2">
        {MISSING_LABELS.map((m) => (
          <button key={m} className={`chip${missing === m ? " chip--on" : ""}`}
            onClick={() => setMissing(missing === m ? "" : m)}>
            <span className="chip__main">{m}</span>
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor={`hn-${dish.title}`}>Anything else?</label>
        <input id={`hn-${dish.title}`} type="text" autoComplete="off" autoCapitalize="sentences"
          autoCorrect="on" spellCheck="true" value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </div>

      {photos.length > 0 && (
        <div className="shots shots--sm">
          {photos.map((src, i) => (
            <button key={i} className="shot__del" onClick={() => setPhotos((ps) => ps.filter((_, n) => n !== i))}
              aria-label={`Remove photo ${i + 1}`}>
              <img src={src} alt={`Photo ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
      {err && <p className="photo__err">{err}</p>}

      <div className="row">
        {photos.length < 3 && (
          <label className="btn btn--ghost btn--sm photo__pick">
            Add a photo
            <input type="file" accept="image/*" className="sr"
              onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        <Btn small onClick={() => onSave({ rating, missing, note, photos })} disabled={!rating}>
          Save
        </Btn>
        <Btn small variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

function HistoryView({ history, currentWeekId, onOpenWeek, onNewWeek, storageOk, onCookAgain, onShareDish, onRateHistory }) {
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const warning = storageOk === false && (
    <section className="card card--warn">
      <h2>Saving isn't working right now</h2>
      <p>
        Artifact storage only runs once an artifact has been published — until then
        writes are dropped silently. Anything below will disappear when you close this.
        Publish the artifact and it'll start saving properly.
      </p>
    </section>
  );

  const newWeekBar = (
    <section className="card card--ask">
      <div className="askmise">
        <MiseAvatar mood="idle" size={46} />
        <div>
          <h2>Start a new week?</h2>
          <p className="hint">
            Keeps your setup, favourites and everything below. Clears the current
            plan, list and recipes.
          </p>
        </div>
      </div>
      <div className="row">
        {!confirming ? (
          <Btn small onClick={() => setConfirming(true)}>Start a new week</Btn>
        ) : (
          <>
            <Btn small onClick={() => { setConfirming(false); onNewWeek(); }}>
              Yes, clear the current plan
            </Btn>
            <Btn small variant="ghost" onClick={() => setConfirming(false)}>Cancel</Btn>
          </>
        )}
      </div>
    </section>
  );

  if (!history.length)
    return (
      <div className="stack">
        {warning}
        <Empty title="Nothing saved yet">
          <p>
            Once you build a shopping list, that week gets saved here automatically —
            what you planned, what you rated, what stuck.
          </p>
        </Empty>
        {newWeekBar}
      </div>
    );

  const sorted = [...history].sort(
    (a, b) => new Date(b.updatedAt || b.startedAt) - new Date(a.startedAt)
  );

  return (
    <div className="stack">
      {warning}
      {newWeekBar}
      {sorted.map((w) => {
        const isCurrent = w.id === currentWeekId;
        const rated = w.dishes?.filter((d) => d.rating != null) || [];
        const avg = rated.length ? rated.reduce((s, d) => s + d.rating, 0) / rated.length : null;
        return (
          <section key={w.id} className={`card hist${isCurrent ? " hist--current" : ""}`}>
            <div className="card__head">
              <div>
                <h2>
                  Week of{" "}
                  {fmtDate(new Date(w.startedAt), { month: "long", day: "numeric" })}
                </h2>
                <p className="hint">
                  {w.people ? `${w.people} ${w.people === 1 ? "person" : "people"}` : ""}
                  {w.shoppingCount != null ? ` · ${w.shoppingCount} items` : ""}
                  {avg != null ? ` · averaged ${avg.toFixed(1)}/5` : ""}
                </p>
              </div>
              {isCurrent && <Tape tilt={-1.5} tone="hot">This week</Tape>}
            </div>

            {w.cravings && <p className="lead">Craving that week: {w.cravings}</p>}

            {w.dishes?.length > 0 && (
              <ul className="hist__dishes">
                {w.dishes.map((d, i) => (
                  <li key={i}>
                    <div>
                      <strong>{d.day ? `${DAY_FULL[d.day]}: ` : ""}{d.title}</strong>
                      {d.fromLeftovers && <span className="hist__tag">from leftovers</span>}
                      {d.cookedAgain && <span className="hist__tag">cooked again</span>}
                      {d.cookedAt && (
                        <span className="hist__when">
                          {fmtDate(new Date(d.cookedAt), { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {d.blurb && <span className="hist__blurb"> — {d.blurb}</span>}
                    </div>
                    <div className="hist__rating">
                      {d.rating != null ? (
                        <span title={`${d.rating} out of 5`}>
                          {"★".repeat(d.rating)}
                          <span className="hist__dim">{"★".repeat(5 - d.rating)}</span>
                        </span>
                      ) : (
                        <span className="hist__unrated">not rated</span>
                      )}
                    </div>
                    {d.photos?.length > 0 && (
                      <div className="shots shots--sm">
                        {d.photos.map((src, i) => <img key={i} src={src} alt={`${d.title}, photo ${i + 1}`} />)}
                      </div>
                    )}
                    {d.missing && d.missing !== "It was great" && (
                      <p className="hist__note">{d.missing}{d.note ? ` — ${d.note}` : ""}</p>
                    )}
                    <div className="row">
                      <Btn small variant="ghost" onClick={() => onCookAgain(d)}>
                        Cook this again
                      </Btn>
                      <Btn small variant="ghost" onClick={() => onShareDish(d)}>
                        Share
                      </Btn>
                      <Btn small variant="ghost"
                        onClick={() => setEditing(editing === `${w.id}:${i}` ? null : `${w.id}:${i}`)}>
                        {d.rating ? "Edit rating" : "Rate it"}
                      </Btn>
                    </div>

                    {editing === `${w.id}:${i}` && (
                      <HistoryRate
                        dish={d}
                        onSave={(patch) => { onRateHistory(w.id, i, patch); setEditing(null); }}
                        onCancel={() => setEditing(null)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isCurrent && (
              <Btn small variant="ghost" onClick={onOpenWeek}>Back to this week</Btn>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* Which model answers, and whose account pays for it.

   Deliberately NOT a "connect your ChatGPT account" flow. Billing a person's
   ChatGPT *subscription* for third-party inference requires the app to identify
   itself to OpenAI as the Codex CLI so the traffic is treated as first-party —
   that's the whole mechanism, and it's exactly what Anthropic prohibited in
   February 2026 (billing enforcement April 2026) and Google closed for Gemini
   CLI around the same time. OpenAI hasn't shut it yet, which is the only reason
   it works anywhere. An API key gets the same result — their account pays,
   ours doesn't — and can't be switched off underneath the app. */
function AiSource() {
  const existing = readByok();
  const [provider, setProvider] = useState(existing?.provider || "");
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(!!existing);
  const [msg, setMsg] = useState("");

  const save = () => {
    if (!provider || !key.trim()) return;
    const ok = writeByok(provider, key.trim());
    setSaved(ok);
    setKey("");   // cleared from React state immediately after handing it off
    setMsg(ok
      ? "Saved on this device. Requests now bill to your own account."
      : "Couldn't save — your browser may be blocking local storage.");
  };

  const clear = () => {
    writeByok(null, null);
    setProvider("");
    setKey("");
    setSaved(false);
    setMsg("Removed. Back to the built-in option.");
  };

  // Collapsed by default and last on the page. This is a power-user escape
  // hatch, not a feature to sell — almost nobody has an API key, and putting it
  // in front of everyone else just raises a question they don't need answered.
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="advlink" onClick={() => setOpen(true)}>
        {saved ? "Using your own API key · change" : "Advanced: use your own API key"}
      </button>
    );
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2>Use your own API key</h2>
        <Btn small variant="ghost" onClick={() => setOpen(false)}>Close</Btn>
      </div>
      <p className="lead">
        Optional. Runs Mise on your own account instead of ours — your model, your billing.
      </p>

      {saved ? (
        <>
          <div className="setg">
            <div className="setg__t setg__t--full">
              <span className="setg__k">Using</span>
              <span className="setg__v setg__v--sm">
                Your own {existing?.provider === "openai" ? "OpenAI" : "Anthropic"} key
              </span>
            </div>
          </div>
          <div className="row">
            <Btn small variant="ghost" onClick={clear}>Use Mise&apos;s built-in instead</Btn>
          </div>
        </>
      ) : (
        <>
          <div className="grid-2">
            <button className={`chip${provider === "openai" ? " chip--on" : ""}`}
              onClick={() => setProvider("openai")}>
              <span className="chip__main">OpenAI</span>
              <span className="chip__sub">platform.openai.com</span>
            </button>
            <button className={`chip${provider === "anthropic" ? " chip--on" : ""}`}
              onClick={() => setProvider("anthropic")}>
              <span className="chip__main">Anthropic</span>
              <span className="chip__sub">console.anthropic.com</span>
            </button>
          </div>

          {provider && (
            <>
              <div className="field">
                <label htmlFor="byok">Your API key</label>
                <input id="byok" type="password" value={key}
                  autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck="false"
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={provider === "openai" ? "sk-…" : "sk-ant-…"} />
              </div>
              <p className="hint">
                A developer-console key, not your ChatGPT or Claude login. Stored only in
                this browser, never on our servers. Usage bills to you.
              </p>
              <div className="row">
                <Btn small onClick={save} disabled={!key.trim()}>Save key</Btn>
              </div>
            </>
          )}
        </>
      )}

      {msg && <p className="hint">{msg}</p>}
    </section>
  );
}

function MyKitchen({ profile, favorites, savedAt, onEdit, onSuggest, onRemove, onShare, busy }) {
  const loved = favorites.filter((f) => f.rating >= 4).slice().reverse();
  const rest = favorites.filter((f) => f.rating < 4).slice().reverse();

  return (
    <div className="stack">
      <section className="card">
        <div className="card__head">
          <h2>Your Setup</h2>
          <Btn small variant="ghost" onClick={onEdit}>Change</Btn>
        </div>
        {/* Same packed tile grid as the start screen. Big numbers get their own
            small tiles; anything that's really a list (nights, equipment) spans
            the full width so it doesn't wrap raggedly in a narrow column. */}
        <div className="setg">
          <div className="setg__t">
            <span className="setg__k">Cooking for</span>
            <span className="setg__v">{profile.people}</span>
          </div>
          <div className="setg__t">
            <span className="setg__k">Minutes</span>
            <span className="setg__v">{profile.time}</span>
          </div>
          <div className="setg__t">
            <span className="setg__k">Heat</span>
            <span className="setg__v setg__v--sm">{SPICE[profile.spice].label}</span>
          </div>
          <div className="setg__t">
            <span className="setg__k">Adventure</span>
            <span className="setg__v setg__v--sm">{ADVENTURE[profile.adventure - 1].label}</span>
          </div>
          <div className="setg__t setg__t--full">
            <span className="setg__k">Nights</span>
            <span className="setg__v setg__v--sm">
              {orderDays(profile.nights).map((d) => DAY_FULL[d]).join(", ") || "None"}
            </span>
          </div>
          <div className="setg__t setg__t--full">
            <span className="setg__k">Avoiding</span>
            <span className="setg__v setg__v--sm">
              {[...profile.restrictions, profile.restrictionsNote].filter(Boolean).join(", ") || "Nothing"}
            </span>
          </div>
          <div className="setg__t setg__t--full">
            <span className="setg__k">Equipment</span>
            <span className="setg__v setg__v--sm">{profile.equipment.join(", ") || "Basic"}</span>
          </div>
          {profile.healthConscious && (
            <div className="setg__t setg__t--full">
              <span className="setg__k">Leaning</span>
              <span className="setg__v setg__v--sm">A bit healthier</span>
            </div>
          )}
        </div>
        {savedAt && <p className="hint">Saved {fmtDate(new Date(savedAt), { month: "long", day: "numeric" })}. Used automatically next week.</p>}
      </section>


      <section className="card">
        <h2>Dishes You Loved</h2>
        {!loved.length && <p className="lead">Nothing yet. Rate a dish after you cook it and it'll show up here.</p>}
        {loved.map((f) => (
          <div key={f.id} className="fav">
            <div>
              <h3>{f.title}</h3>
              <p className="fav__meta">
                {f.rating} out of 5 · {fmtDate(new Date(f.date), { month: "short", day: "numeric" })}
                {f.note ? ` · "${f.note}"` : ""}
              </p>
              {f.photos?.length > 0 && (
                <div className="shots shots--sm">
                  {f.photos.map((src, i) => <img key={i} src={src} alt={`${f.title}, photo ${i + 1}`} />)}
                </div>
              )}
            </div>
            <div className="fav__acts">
              <Btn small variant="ghost" onClick={() => onSuggest(f)} disabled={!!busy}>More like this</Btn>
              <Btn small variant="ghost" onClick={() => onShare(f)}>Share</Btn>
              <Btn small variant="ghost" onClick={() => onRemove(f.id)}>Remove</Btn>
            </div>
          </div>
        ))}
      </section>

      {rest.length > 0 && (
        <section className="card">
          <h2>Didn't quite land</h2>
          <p className="lead">I use these too — they tell me what to build in next time.</p>
          {rest.map((f) => (
            <div key={f.id} className="fav">
              <div>
                <h3>{f.title}</h3>
                <p className="fav__meta">{f.rating} out of 5{f.missing ? ` · ${f.missing}` : ""}</p>
              </div>
              <Btn small variant="ghost" onClick={() => onRemove(f.id)}>Remove</Btn>
            </div>
          ))}
        </section>
      )}

      {/* Last thing on the page, collapsed. */}
      <AiSource />
    </div>
  );
}

/* ==========================================================================
   COOKING EXPERIENCE — helpers
   Different constraints from the rest of the app: hands are wet, the phone is on
   the counter a few feet away, and the screen wants to sleep. So: voice out, big
   targets, timers that keep running while you move between steps.
   ========================================================================== */

/* Pull cookable durations out of step text. "simmer 8 to 10 minutes" offers a
   10-minute timer — the upper bound, because under-cooking is the worse failure. */
function parseDurations(text) {
  const out = [];
  const re = /(\d+(?:\.\d+)?)\s*(?:(?:to|–|—|-|or)\s*(\d+(?:\.\d+)?)\s*)?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const hi = parseFloat(m[2] || m[1]);
    const unit = m[3].toLowerCase();
    const mult = unit.startsWith("s") ? 1 : unit.startsWith("m") ? 60 : 3600;
    const seconds = Math.round(hi * mult);
    if (seconds >= 20 && seconds <= 6 * 3600) {
      const label = unit.startsWith("h")
        ? `${hi} hour${hi === 1 ? "" : "s"}`
        : unit.startsWith("m")
        ? `${hi} min`
        : `${hi} sec`;
      if (!out.some((o) => o.seconds === seconds)) out.push({ seconds, label });
    }
  }
  return out.slice(0, 3);
}

function clockFmt(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
}

/* A chime rather than a sample — no asset to load, works offline. */
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.28, 0.56].forEach((offset, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = i === 2 ? 1046 : 784;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + offset;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.start(t);
      o.stop(t + 0.26);
    });
    setTimeout(() => ctx.close?.(), 1400);
  } catch (_) {
    /* muted device, or no audio context — the visual alert still fires */
  }
}

/* Speech synthesis, feature-detected. `force` speaks even when voice is off, so
   "Read it again" always works. */
function useSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [on, setOn] = useState(false);

  const speak = useCallback(
    (text, force = false) => {
      if (!supported || (!on && !force) || !text) return;
      try {
        /* cancel() is asynchronous — the engine keeps tearing down after the
           call returns. Calling speak() immediately after starts the new
           utterance mid-teardown, which clips the first word or two. A short
           gap lets the queue actually drain first. */
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        u.rate = 0.92;
        u.pitch = 1.02;
        setTimeout(() => {
          try {
            // Some engines suspend themselves between utterances and need a
            // nudge, or the first speak() after idle produces nothing.
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
            window.speechSynthesis.speak(u);
          } catch (_) {}
        }, 120);
      } catch (_) {}
    },
    [supported, on]
  );

  const stop = useCallback(() => {
    if (supported) { try { window.speechSynthesis.cancel(); } catch (_) {} }
  }, [supported]);

  useEffect(() => () => { if (supported) { try { window.speechSynthesis.cancel(); } catch (_) {} } }, [supported]);

  return { supported, on, setOn, speak, stop };
}

/* Timers live above the step list so they survive navigation — rice keeps going
   while you read the sauce step. */
function useTimers(onDone) {
  const [timers, setTimers] = useState([]);
  const firedRef = useRef({});

  /* A running timer stores endsAt (a wall-clock target) so it stays accurate even
     if the tab is backgrounded and the interval stops firing. A paused timer stores
     remaining instead, and endsAt is recomputed from it on resume. */
  useEffect(() => {
    if (!timers.some((t) => !t.done && !t.paused)) return;
    const iv = setInterval(() => {
      setTimers((ts) =>
        ts.map((t) => {
          if (t.done || t.paused) return t;
          const remaining = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
          if (remaining === 0 && !firedRef.current[t.id]) {
            firedRef.current[t.id] = true;
            chime();
            onDone?.(t);
          }
          return { ...t, remaining, done: remaining === 0 };
        })
      );
    }, 500);
    return () => clearInterval(iv);
  }, [timers, onDone]);

  const add = (label, seconds, stepIndex) =>
    setTimers((ts) => [
      ...ts,
      {
        id: uid(),
        label,
        seconds,
        remaining: seconds,
        endsAt: Date.now() + seconds * 1000,
        paused: false,
        done: false,
        stepIndex,
      },
    ]);

  /* Jump forwards or backwards. Adding time to a finished timer revives it —
     "it needs another two minutes" is the single most common thing that happens
     when a timer goes off, so it shouldn't require starting a new one. */
  const adjust = (id, deltaSeconds) =>
    setTimers((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const base = t.paused || t.done ? t.remaining : Math.round((t.endsAt - Date.now()) / 1000);
        const next = Math.max(0, base + deltaSeconds);
        if (next > 0) firedRef.current[t.id] = false;  // allow it to chime again
        return {
          ...t,
          remaining: next,
          endsAt: t.paused ? t.endsAt : Date.now() + next * 1000,
          done: next === 0,
          // reviving a finished timer resumes it; an adjusted paused timer stays paused
          paused: t.done && next > 0 ? false : t.paused,
        };
      })
    );

  const togglePause = (id) =>
    setTimers((ts) =>
      ts.map((t) => {
        if (t.id !== id || t.done) return t;
        if (t.paused) {
          return { ...t, paused: false, endsAt: Date.now() + t.remaining * 1000 };
        }
        const remaining = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
        return { ...t, paused: true, remaining };
      })
    );

  const restart = (id) =>
    setTimers((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        firedRef.current[t.id] = false;
        return { ...t, remaining: t.seconds, endsAt: Date.now() + t.seconds * 1000, paused: false, done: false };
      })
    );

  const remove = (id) => setTimers((ts) => ts.filter((t) => t.id !== id));
  const clearDone = () => setTimers((ts) => ts.filter((t) => !t.done));

  return { timers, add, adjust, togglePause, restart, remove, clearDone };
}

/* Keep the screen awake if the browser allows it. Silently skipped if not. */
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;
    let lock;
    let cancelled = false;
    (async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) lock.release();
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
      try { lock?.release(); } catch (_) {}
    };
  }, [active]);
}

/* Voice input. Chrome-ish only, so the button hides itself where unsupported
   rather than presenting a control that does nothing. */
function useDictation(onResult) {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [listening, setListening] = useState(false);
  const ref = useRef(null);

  const start = () => {
    if (!SR) return;
    try {
      const r = new SR();
      r.lang = "en-US";
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        const t = e.results?.[0]?.[0]?.transcript;
        if (t) onResult(t);
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      ref.current = r;
      r.start();
      setListening(true);
    } catch (_) {
      setListening(false);
    }
  };

  const stop = () => { try { ref.current?.stop(); } catch (_) {} setListening(false); };

  return { supported: !!SR, listening, start, stop };
}

/* The logo mark: the same toque silhouette as her portrait, standing alone. Reusing
   the exact path data means the wordmark and the character read as one drawing at
   two sizes, not a mascot and a separate, unrelated logotype. */
function MiseMark({ size = 40 }) {
  return (
    <svg
      className="mise-mark"
      width={size}
      height={(size * 34) / 64}
      viewBox="0 0 64 34"
      role="img"
      aria-label="Mise"
    >
      <path
        d="M17 24c-3.4 0-5.6-2.6-4.8-5.6.6-2.3 3-3.4 5-2.7.2-3.2 2.9-5.5 6.2-5.2 1.3-2.9 4.6-4.3 7.8-3.3 2.4-2.2 6.3-1.9 8.3.7 2.6-.8 5.4.6 6.3 3.1 2.2-.4 4.3 1 4.7 3.2.5 2.8-1.7 5.4-4.9 5.4z"
        fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round"
      />
      <path d="M17 24h28.6v4.6H17z" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------ MISE, DRAWN */
/* Line-art rather than a glossy mascot, so she belongs to the same world as the
   masking-tape labels and steel greys. Her expression is driven by state: she
   leans in and steams while thinking, and looks worried when something's burning.
   A face that never changes isn't a character, it's a logo. */
function MiseAvatar({ mood = "idle", size = 44 }) {
  const thinking = mood === "thinking";
  const worried = mood === "worried";
  const happy = mood === "happy";
  return (
    <svg
      className={`mise-av mise-av--${mood}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Mise, your sous chef"
    >
      {thinking && (
        <g className="mise-av__steam" stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.55" strokeLinecap="round">
          <path d="M9 26c-2.6-2.4.6-4.6-2-7 -2.2-2 .4-4 -1.4-5.8" />
          <path d="M55 26c2.6-2.4-.6-4.6 2-7 2.2-2-.4-4 1.4-5.8" />
        </g>
      )}

      {/* toque */}
      <path
        d="M17 24c-3.4 0-5.6-2.6-4.8-5.6.6-2.3 3-3.4 5-2.7.2-3.2 2.9-5.5 6.2-5.2 1.3-2.9 4.6-4.3 7.8-3.3 2.4-2.2 6.3-1.9 8.3.7 2.6-.8 5.4.6 6.3 3.1 2.2-.4 4.3 1 4.7 3.2.5 2.8-1.7 5.4-4.9 5.4z"
        fill="var(--card)" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"
      />
      <path d="M17 24h28.6v4.2H17z" fill="var(--card)" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />

      {/* head */}
      <path
        d="M20 28.4h23c0 8.6-.9 13.4-4.2 16.2-2 1.7-4.3 2.3-7.3 2.3s-5.3-.6-7.3-2.3C20.9 41.8 20 37 20 28.4z"
        fill="var(--card)" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"
      />

      {/* brows — the main carrier of mood */}
      {worried ? (
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M24 33.5l4.6-1.8" />
          <path d="M39 33.5l-4.6-1.8" />
        </g>
      ) : thinking ? (
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M24.4 33.2c1.2-1.5 3.4-1.6 4.6-.5" />
          <path d="M38.6 33.2c-1.2-1.5-3.4-1.6-4.6-.5" />
        </g>
      ) : null}

      {/* eyes */}
      {thinking ? (
        <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M25.4 37.4c1-1.1 2.4-1.1 3.4 0" />
          <path d="M34.6 37.4c1-1.1 2.4-1.1 3.4 0" />
        </g>
      ) : (
        <g fill="currentColor">
          <circle cx="27.1" cy="37.4" r="1.85" />
          <circle cx="36.3" cy="37.4" r="1.85" />
        </g>
      )}

      {/* mouth */}
      {happy ? (
        <path d="M28 41.8c1.6 2.1 5.5 2.1 7.1 0" stroke="currentColor" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      ) : worried ? (
        <path d="M28.4 42.9c1.5-1.7 5.2-1.7 6.7 0" stroke="currentColor" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M28.6 41.9c1.5 1.2 4 1.2 5.6 0" stroke="currentColor" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      )}

      {/* neckerchief */}
      <path d="M25.6 46.8l6.4 5.2 6.4-5.2 3.1 1.5-9.5 7.4-9.5-7.4z" fill="var(--hot)" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />

      {/* shoulders + taped name badge */}
      <path d="M13 64c1.4-6.6 7-10.6 13.6-11.9L32 56l5.4-3.9C44 53.4 49.6 57.4 51 64z"
        fill="var(--card)" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M37.2 57.6l10.2 1.1-.5 4.1-10.2-1z" fill="var(--tape)" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/* ------------------------------------------------------------------- SWAP
   Tapping "swap" used to fire a request straight off with a generic reason and
   no visible response, which read as a dead button. Asking why first gives the
   person control, gives Mise something useful to work with, and — most
   practically — puts something on screen the instant you tap. */

const SWAP_REASONS = [
  "I don't like it",
  "I can't find it",
  "Too expensive",
  "Too much to buy for one dish",
  "I can't eat it",
  "I've already got something similar",
];

function SwapDialog({ item, mode, onCancel, onSubmit, busy }) {
  const [reasons, setReasons] = useState([]);
  const [note, setNote] = useState("");
  const closeRef = useRef(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);

  const toggle = (r) =>
    setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const send = () => {
    const why = [...reasons, note.trim()].filter(Boolean).join("; ");
    const tail =
      mode === "shopping"
        ? "Swap it for something else and update any recipes that used it."
        : "What are my options? Keep the dish working without it.";
    onSubmit(`About "${item}" — ${why || "I'd rather not use it"}. ${tail}`);
  };

  return (
    <div className="swapwrap" role="dialog" aria-modal="true" aria-label={`Swap ${item}`}>
      <div className="swapbox">
        <div className="swapbox__hd">
          <MiseAvatar mood="idle" size={44} />
          <div>
            <h2>Swap {item}?</h2>
            <p className="hint">Tell me why and I&apos;ll work around it.</p>
          </div>
          <button className="cask__x" onClick={onCancel} ref={closeRef}>Close</button>
        </div>

        <div className="grid-2">
          {SWAP_REASONS.map((r) => (
            <Chip key={r} active={reasons.includes(r)} onClick={() => toggle(r)}>{r}</Chip>
          ))}
        </div>

        <div className="field">
          <label htmlFor="swapnote">Anything else? (optional)</label>
          <input id="swapnote" type="text" autoComplete="off" autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={note} placeholder="It never gets used up"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()} />
        </div>

        <div className="row">
          <Btn onClick={send} disabled={!!busy}>
            {busy ? "Asking…" : "Ask Mise"}
          </Btn>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- SOUS CHEF */

/* Things she says when you open the panel with nothing asked yet. Rotating, so she
   doesn't feel like a recording. */
const MISE_HELLOS = [
  "Right — what are we doing?",
  "I'm here. What's the pan doing?",
  "Talk to me. Short questions are fine.",
  "Go ahead, I'm watching.",
  "What's going on in there?",
];

const TROUBLE = /burn|burnt|smok|fire|alarm|ruin|overcook|raw|undercook|stuck|dry|curdl|split|too salty|help|wrong|panic/i;

function MisePanel({ thread, busy, onClose, onAsk, dish, asks = QUICK_ASKS.default }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  const closeRef = useRef(null);
  const hello = useMemo(() => MISE_HELLOS[Math.floor(Math.random() * MISE_HELLOS.length)], []);

  const lastFromUser = [...thread].reverse().find((m) => m.who === "me");
  const mood = busy
    ? "thinking"
    : lastFromUser && TROUBLE.test(lastFromUser.text)
    ? "worried"
    : thread.length
    ? "happy"
    : "idle";

  const status = busy
    ? "Thinking…"
    : mood === "worried"
    ? "On it — let's save this"
    : dish
    ? `At the stove · ${dish.title}`
    : "Your sous chef";

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread.length, busy]);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const send = (t) => { onAsk(t); setText(""); };

  return (
    <div className="sheet no-print" role="dialog" aria-modal="true" aria-label="Mise, your sous chef">
      <div className="sheet__hdr">
        <div className="sheet__id">
          <span className="sheet__plate"><MiseAvatar mood={mood} size={46} /></span>
          <div>
            <span className="sheet__name">Mise</span>
            <span className="sheet__role" aria-live="polite">{status}</span>
          </div>
        </div>
        <button className="sheet__x" onClick={onClose} ref={closeRef}>Close</button>
      </div>

      <div className="sheet__body">
        {!thread.length && (
          <div className="says">
            <MiseAvatar mood="idle" size={40} />
            <div className="bub bub--mise">
              <span className="bub__who">Mise</span>
              <p>{hello}</p>
              <p className="bub__can">
                I can change your shopping list and rewrite recipes — just ask.
              </p>
            </div>
          </div>
        )}

        {thread.map((m, i) =>
          m.who === "mise" ? (
            <div key={i} className="says">
              <MiseAvatar mood={i === thread.length - 1 ? mood : "idle"} size={40} />
              <div className="bub bub--mise">
                <span className="bub__who">Mise</span>
                <p>{m.text}</p>
              </div>
            </div>
          ) : (
            <div key={i} className="bub bub--me">
              <span className="bub__who">You</span>
              <p>{m.text}</p>
            </div>
          )
        )}

        {busy && (
          <div className="says">
            <MiseAvatar mood="thinking" size={40} />
            <div className="bub bub--mise bub--wait"><Working label="Thinking" /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sheet__quick" aria-label="Common questions">
        {asks.map((q) => (
          <button key={q} className="quick" onClick={() => send(q)} disabled={busy}>{q}</button>
        ))}
      </div>

      <div className="sheet__foot">
        <label className="sr" htmlFor="mq">Ask Mise a question</label>
        <input id="mq" name="miseStoveAsk" type="text" inputMode="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore autoCapitalize="sentences" autoCorrect="on" spellCheck="true" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="What's happening in the pan?"
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) send(text); }} />
        <Btn small onClick={() => text.trim() && send(text)} disabled={!text.trim() || busy}>Ask</Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- CSS */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900;1,600;1,700&display=swap');

.app{
  /* Palette: rose, brick, ink-navy, indigo, plum — weighted toward paper white.
     Surfaces are white on a warm rose-tinted ground, so cards read by their
     elevation rather than by an outline drawn around everything. */
  --rose:#EE9265; --brick:#B44722; --navy:#12141C; --indigo:#3C3F63; --plum:#573C56;

  --paper:#FAF5F4;          /* the ground */
  --surface:#FFFFFF;        /* raised cards */
  --sunk:#F4EBE9;           /* recessed wells */
  --ink:#1A1B24;            /* body text */
  --ink-2:#4A4453;          /* secondary text */
  --muted:#6E6472;          /* tertiary */
  --rule:rgba(87,60,86,.14);   /* hairlines, not borders */
  --rule-2:rgba(87,60,86,.26);
  --hot:#B44722;            /* primary accent */
  --good:#2F6B54;
  --tape:#F0D9D5; --tape-ink:#57303A;
  --warn:#7A4630; --warn-bg:#FBEDE9;
  --bw:1px;
  /* Bottom-edge tones for the 3D press effect. Derived directly from the
     palette above (same hue, ~72% lightness) — no new colors, just shadowed
     faces of the ones already here. */
  --brick-edge:#813318; --good-edge:#214D3C; --rose-edge:#AB6948;
  --plum-edge:#3E2B3D; --surface-edge:#E4D7D3;
  /* Glass: translucent fill + saturation boost so colour bleeds through from
     behind, a hairline rim, and a specular top highlight. The highlight is
     what sells it as a lit pane rather than just something transparent. */
  --glass:rgba(255,255,255,.58);
  --glass-strong:rgba(255,255,255,.70);
  --glass-rim:rgba(255,255,255,.75);
  /* url(#glassDistort) bends content behind the panel; saturate+blur handle
     colour and softness the same way as before. Real, tested optical
     distortion — not a heavier blur pretending to be one. */
  --glass-blur:url(#glassDistort) saturate(180%) blur(20px);
  --spec:inset 0 1px 0 rgba(255,255,255,.9);
  --lift-1:0 1px 2px rgba(87,60,86,.06), 0 8px 24px -10px rgba(87,60,86,.22);
  --lift-2:0 2px 6px rgba(87,60,86,.07), 0 18px 44px -16px rgba(87,60,86,.28);
  --shadow:0 1px 2px rgba(30,20,30,.04), 0 6px 18px -8px rgba(87,60,86,.16);
  --shadow-lift:0 2px 4px rgba(30,20,30,.05), 0 18px 40px -14px rgba(87,60,86,.24);

  /* TRANSPARENT on purpose. The surface the glass refracts lives in its own
     fixed layer (.surface, below) so scrolling never repaints it — only a
     composited transform moves it. An opaque background here would sit directly
     on top of that layer and hide it completely, which is exactly what happened
     the first time. The paper colour lives on the body as the fallback. */
  background:transparent; color:var(--ink);
  font-family:'Nunito',system-ui,sans-serif; line-height:1.55; font-weight:600;
  min-height:100vh; padding-bottom:7rem;
}
/* keep legacy names working so nothing goes unstyled mid-refactor */
.app{--steel:var(--sunk); --card:var(--surface); --line:var(--rule-2); --blade:var(--muted)}
/* Sized in rem, not px, so the reader's own browser text-size setting scales the
   whole interface. Contrast follows the operating system rather than an in-app toggle. */
.app{font-size:1.125rem}

@media (prefers-contrast:more){.app{
  --steel:#FFFFFF; --card:#FFFFFF; --ink:#000000; --ink-2:#1A1A1A;
  --blade:#2B2B2B; --line:#000000; --hot:#A6431F; --good:#0C4429;
  --tape:#FFF3B0; --tape-ink:#000; --warn:#4A2C00; --warn-bg:#FFF6E0; --bw:2px;
}}

.app *{box-sizing:border-box;min-width:0}
/* NOT overflow-x:hidden. Any overflow value other than visible on an ancestor
   silently makes position:sticky inert in every descendant — which is why the
   nav never actually pinned despite having correct sticky CSS. clip does the
   same job of preventing sideways scroll without breaking sticky. */
.app{overflow-x:clip}
/* every string here is model-generated and can be any length */
.app p,.app li,.app strong,.app span{overflow-wrap:anywhere}
.app input[type=text],.app textarea,.app select{max-width:100%}
.app h1,.app h2,.app h3,.app h4{font-family:'Nunito',system-ui,sans-serif;font-weight:800;
  letter-spacing:-.025em;margin:0;line-height:1.18;color:var(--navy)}
.app h2{font-size:1.48em}
.app h3{font-size:1.1em;letter-spacing:-.015em}
.app h4{font-size:.96em;font-weight:650;color:var(--plum)}
.app p{margin:.6em 0 0}
/* Headings are navy by default; on dark surfaces they must inherit or they vanish. */
.card--dark h1,.card--dark h2,.card--dark h3,.card--dark h4,
.cook h1,.cook h2,.cook h3,.cook h4,
.sheet__hdr h1,.sheet__hdr h2,.busybar h2{color:inherit}

.app button:focus-visible,.app input:focus-visible,.app textarea:focus-visible,
.app select:focus-visible,.app [tabindex]:focus-visible{outline:3px solid var(--hot);outline-offset:3px}
@media (prefers-contrast:more){.app button:focus-visible{outline-width:4px}}
@media (prefers-reduced-motion:reduce){.app *{animation:none!important;transition:none!important}}

/* Surfaces that used to teleport in now settle into place. Entrance only —
   these mount and unmount with the conditional, so there's no exit to animate
   without holding state open past the close click, which risked more than it
   was worth. prefers-reduced-motion above turns all of this off. */
@keyframes surfaceUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes surfaceDown{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
@keyframes surfaceIn{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes scrimIn{from{opacity:0}to{opacity:1}}
@keyframes bodyIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.sheet{animation:surfaceUp .26s ease-out}
.swapwrap{animation:scrimIn .16s ease-out}
.swapbox{animation:surfaceIn .22s ease-out}
.cask{animation:surfaceUp .22s ease-out}
.cook__ding{animation:surfaceUp .24s ease-out}
.fold__body{animation:bodyIn .16s ease-out}
.eco{animation:bodyIn .16s ease-out}

.sr,.sr-focus{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.tape{display:inline-block;background:var(--tape);color:var(--tape-ink);
  font-family:'Nunito',sans-serif;font-weight:700;font-size:.78em;letter-spacing:.1em;
  text-transform:uppercase;padding:.3rem .75rem;
  clip-path:polygon(2% 0,98% 3%,100% 96%,3% 100%)}
.tape--hot{background:var(--hot);color:#fff}

/* header */
.hdr{max-width:960px;margin:0 auto;padding:1.4rem 1.15rem .6rem}
.hdr__row{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}
.hdr__mark{display:flex;align-items:center;gap:.7rem;background:none;border:none;padding:.2rem;
  margin:-.2rem;cursor:pointer;border-radius:14px;font:inherit;color:inherit;text-align:left;
  transition:opacity .16s ease, transform .12s ease}
.hdr__mark:hover{opacity:.75}
.hdr__mark:active{transform:scale(.97)}
.profile{width:52px;height:52px;flex:0 0 auto;border-radius:50%;background:var(--surface);
  border:1px solid var(--rule-2);color:var(--plum);cursor:pointer;display:flex;
  align-items:center;justify-content:center;box-shadow:var(--shadow)}
.profile:hover{border-color:var(--brick);color:var(--brick)}
.profile--on{background:var(--brick);border-color:var(--brick);color:#fff}
.mise-mark{color:var(--brick);flex:0 0 auto}
.hdr__word{display:flex;flex-direction:column;line-height:1;gap:.28rem}
.hdr__logo{font-family:'Nunito',sans-serif;font-weight:600;font-size:1.85em;
  letter-spacing:-.015em;color:var(--navy);font-style:italic}
.hdr__tag{font-family:'Nunito',sans-serif;font-weight:600;font-size:.62em;
  letter-spacing:.24em;text-transform:uppercase;color:var(--plum)}

/* nav */
.nav{display:flex;gap:.3rem;overflow-x:auto;max-width:960px;margin:0 auto;padding:.6rem 1.15rem;
  border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:5;
  background:rgba(250,245,244,.62);
  -webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur)}
.nav__b{flex:0 0 auto;min-height:44px;padding:0 1.05rem;background:none;border:none;
  font-family:'Nunito',sans-serif;font-weight:700;font-size:.92em;color:var(--muted);
  letter-spacing:-.005em;cursor:pointer;border-radius:16px;position:relative;
  transition:background .16s ease, color .16s ease}
.nav__b:hover{color:var(--ink)}
.nav__dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--brick);
  margin-left:.35rem;vertical-align:middle}
.nav__b--on{background:var(--brick);color:#fff;font-weight:800;
  box-shadow:var(--spec), 0 4px 14px -6px rgba(180,71,34,.65)}

.main{max-width:960px;margin:0 auto;padding:1.15rem}
.stack{display:flex;flex-direction:column;gap:1.1rem}
.sec-h{margin-top:.4rem}

/* cards */
.card{background:var(--glass);-webkit-backdrop-filter:var(--glass-blur);
  backdrop-filter:var(--glass-blur);
  border:1px solid var(--glass-rim);border-radius:26px;
  padding:1.5rem 1.35rem;box-shadow:var(--spec), var(--lift-1);
  position:relative;isolation:isolate;--gx:50%;--gy:20%}
/* A highlight that tracks the pointer rather than sitting fixed — real
   Liquid Glass shifts its specular response as content and viewpoint move;
   a highlight painted in one spot is the single biggest tell of a static
   fake. ::before keeps it out of normal document flow, mix-blend-mode:overlay
   so it lights the surface rather than sitting on top of it as a visible
   circle. Skipped entirely under prefers-reduced-motion — cursor-chasing
   light is exactly the kind of motion that spec is meant to opt out of. */
.card::before{content:"";position:absolute;inset:0;border-radius:inherit;
  pointer-events:none;z-index:1;
  background:radial-gradient(circle at var(--gx) var(--gy), rgba(255,255,255,.8), transparent 58%);
  opacity:.65;mix-blend-mode:overlay;transition:opacity .3s ease}
@media(prefers-reduced-motion:reduce){.card::before{display:none}}
/* Larger surfaces get a larger radius so corners stay visually concentric
   with the elements nested inside them rather than fighting them. */
.card--big{padding:2rem 1.6rem;border-radius:32px;box-shadow:var(--spec), var(--lift-2)}
.hero{text-align:center;padding:.6rem 0 .4rem;max-width:34rem;margin:0 auto}
.hero__mark{display:flex;justify-content:center;margin-bottom:1rem}
.hero__mark .mise-av{filter:drop-shadow(0 10px 20px rgba(180,71,34,.28))}
.hero__h{font-size:1.7em;line-height:1.22;letter-spacing:-.02em;margin:0}
.hero__sub{margin-top:.9rem;font-size:1.06em;color:var(--ink-2);line-height:1.55}
.row--center{justify-content:center}
@media(min-width:640px){.hero__h{font-size:2.1em}}
/* Not everything needs to be a box. Some sections sit straight on the paper. */
.card--flat{background:none;box-shadow:none;padding:0}
.card--flat > h2{margin-bottom:.2rem}
.card--dark{background:var(--indigo);color:#F2EFF6;border:none;border-radius:24px;
  box-shadow:var(--shadow-lift)}
.card--dark .eco__why{color:#C9D6D0}
.card--warn{background:var(--warn-bg);box-shadow:none;border:1px solid rgba(122,70,48,.28)}
.card--warn h2{color:var(--warn)}
.card--ask{background:var(--sunk);box-shadow:none}
.card__head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}
/* Keeps a pair of header buttons together as a single unit — otherwise
   space-between treats each as its own item and splits them apart. */
.headacts{display:flex;gap:.45rem;flex:0 0 auto;align-items:center}
/* A long heading was pushing a single trailing button onto its own line.
   flex-basis must be 0, not auto — with auto the heading's content width is
   still counted when deciding whether to wrap, so it wrapped before it ever
   shrank. */
.card__head > h2{flex:1 1 0;min-width:0}
.card__head > .btn{flex:0 0 auto}
.lead{color:var(--ink-2);max-width:58ch;font-size:1.02em}
.hint{color:var(--muted);font-size:.92em;max-width:58ch;font-style:italic}
.hint--save{margin-top:.9rem}
.hint--center{text-align:center;margin-top:1.1rem;max-width:none}
.row{display:flex;gap:.65rem;flex-wrap:wrap;margin-top:1rem;align-items:center}

/* buttons — a solid top face sitting on a darker edge, so pressing physically
   pushes the face down onto it. Everything else in this redesign follows from
   the same idea: objects with thickness, not flat rectangles with soft shadows.
   The 4px offset is the whole effect; keeping it in the layout (rather than as
   an outer shadow) is what makes the press feel like real displacement. */
.btn{font-family:'Nunito',system-ui,sans-serif;font-weight:700;font-size:1em;
  letter-spacing:-.005em;
  border-radius:18px;padding:.75rem 1.5rem;min-height:52px;cursor:pointer;
  border:none;background:var(--brick);color:#fff;
  box-shadow:0 2px 0 var(--brick-edge), var(--spec), var(--lift-1);
  transition:transform .14s cubic-bezier(.3,.8,.4,1), box-shadow .14s ease, filter .16s ease}
.btn:hover:not(:disabled){filter:brightness(1.05)}
.btn:active:not(:disabled){transform:translateY(2px);
  box-shadow:0 0 0 var(--brick-edge), var(--spec)}
.btn--ghost{background:var(--glass-strong);color:var(--plum);
  -webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);
  border:1px solid var(--rule-2);
  box-shadow:0 2px 0 var(--surface-edge), var(--spec), var(--lift-1)}
.btn--ghost:active:not(:disabled){transform:translateY(2px);
  box-shadow:0 0 0 var(--surface-edge), var(--spec)}
.btn--hot{background:var(--hot);box-shadow:0 2px 0 var(--brick-edge), var(--spec), var(--lift-1)}
.btn--good{background:var(--good);box-shadow:0 2px 0 var(--good-edge), var(--spec), var(--lift-1)}
.btn--good:active:not(:disabled){transform:translateY(2px);
  box-shadow:0 0 0 var(--good-edge), var(--spec)}
.btn--wide{width:100%}
.btn--sm{min-height:46px;padding:.55rem .95rem;font-size:.86em;border-radius:14px}
/* The press animation is displacement, not decoration — but honor the setting. */
@media(prefers-reduced-motion:reduce){.btn{transition:none}}
.btn:disabled{opacity:.45;cursor:not-allowed}
.linkish{background:none;border:none;color:var(--ink);text-decoration:underline;cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:.9em;padding:.6rem 0;min-height:44px;text-align:left}

/* chips */
.chip{display:flex;flex-direction:column;gap:.15rem;text-align:left;
  background:var(--glass-strong);
  -webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);
  border:1px solid var(--rule-2);border-radius:18px;padding:.8rem 1rem;min-height:56px;
  font-family:'Nunito',system-ui,sans-serif;font-weight:700;font-size:.95em;color:var(--ink-2);
  cursor:pointer;width:100%;box-shadow:0 2px 0 var(--surface-edge), var(--spec), var(--lift-1);
  transition:transform .14s cubic-bezier(.3,.8,.4,1), box-shadow .14s ease,
    background .16s ease, border-color .16s ease}
.chip:hover{border-color:var(--rose)}
.chip:active{transform:translateY(2px);box-shadow:0 0 0 var(--surface-edge), var(--spec)}
/* active is a warm tint with a brick edge, not a slab of black */
/* Selected state tints the glass rather than replacing it with a flat fill —
   the material stays visible, it just takes on the accent colour. */
.chip--on{background:rgba(238,146,101,.20);color:var(--brick);border-color:var(--brick);
  font-weight:800;box-shadow:0 2px 0 var(--rose), var(--spec), var(--lift-1)}
.chip--on:active{box-shadow:0 0 0 var(--rose), var(--spec)}
.chip__main{font-weight:800}
.chip__sub{font-size:.82em;opacity:.75}
.grid-2{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.55rem;margin-top:1rem}
/* a heading following a group of controls needs air */
.grid-2 + h3,.grid-days + h3,.counts + h3,.scale + h3,.stepper + h3{margin-top:1.6rem;display:block}
.grid-days{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.5rem;margin-top:.9rem}

/* scale */
.scale{display:flex;flex-direction:column;gap:.5rem;margin-top:1rem}
.scale__o{display:flex;flex-direction:column;gap:.2rem;text-align:left;background:var(--surface);
  border:1px solid var(--rule);border-radius:16px;padding:.85rem .9rem;min-height:60px;cursor:pointer;color:var(--ink);
  transition:background .12s ease, border-color .12s ease, transform .12s ease}
.scale__o:active{transform:scale(.98)}
/* warm tint + brick edge, matching .chip--on — not an inverted black block */
.scale__o--on{background:#FBEAE8;color:var(--brick);border-color:var(--brick);font-weight:650}
.scale__label{font-family:'Nunito',sans-serif;font-weight:700;font-size:1.02em}
.scale__note{font-size:.9em;opacity:.8}

/* fields */
.field{margin-top:1.1rem;display:flex;flex-direction:column;gap:.4rem}
/* A button or chip group immediately after a text field was landing flush against
   it — the field has bottom margin of its own but the button had none, so they
   touched. These rules give every such pairing room without hunting them one by one. */
.field + .btn,
.field + .row,
.field + .grid-2,
.field + .stars,
.field + .shots,
.field + h3{margin-top:1.4rem}
/* A bare h3 has margin:0 globally, so anything right after a callout box or a
   field sat flush against it with no visible gap at all. */
.learn + h3,
.learn + .sec-h{margin-top:1.6rem}
.btn + .field,
.row + .field,
.grid-2 + .field{margin-top:1.25rem}
.card > .btn:last-child{margin-top:1rem}
h3 + .grid-2,h3 + .scale,h3 + .counts{margin-top:.9rem}
.field--hi{border-left:4px solid var(--hot);padding-left:.85rem}
.field label{font-family:'Nunito',sans-serif;font-weight:600;font-size:.87em;color:var(--muted)}
.app input[type=text],.app textarea,.app select{width:100%;background:var(--surface);color:var(--ink);
  border:1px solid var(--rule-2);border-radius:14px;padding:.75rem .95rem;
  font-family:'Nunito',sans-serif;font-size:1em;min-height:52px;
  transition:border-color .12s ease, box-shadow .12s ease}
.app input[type=text]:focus,.app textarea:focus,.app select:focus{border-color:var(--brick);
  box-shadow:0 0 0 4px rgba(180,71,34,.12);outline:none}
@media (prefers-contrast:more){.app input[type=text],.app textarea,.app select{border-width:2px}}
.check{display:flex;gap:.7rem;align-items:center;margin-top:1rem;cursor:pointer;min-height:48px}
.check input{width:26px;height:26px;accent-color:var(--hot);flex:0 0 auto}
.stepper{display:flex;align-items:center;gap:.2rem;margin-top:1rem;overflow:hidden;
  border:1px solid var(--rule);border-radius:18px;width:fit-content;background:var(--surface)}
.stepper button{width:60px;height:60px;background:none;border:none;font-size:1.7em;cursor:pointer;color:var(--ink)}
.stepper span{min-width:3rem;text-align:center;font-size:1.5em;font-weight:600;
  font-family:'Nunito',sans-serif}
/* per-night headcounts */
.counts{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.5rem;margin-top:.9rem}
.count{display:flex;align-items:center;justify-content:space-between;gap:.6rem;
  background:var(--sunk);border-radius:16px;padding:.5rem .6rem .5rem 1rem}
.count__day{font-family:'Nunito',sans-serif;font-weight:600;font-size:.95em}
.count__ctl{display:flex;align-items:center;background:var(--surface);border-radius:999px;
  border:1px solid var(--rule)}
.count__ctl button{width:44px;height:44px;background:none;border:none;font-size:1.3em;
  cursor:pointer;color:var(--plum);border-radius:999px}
.count__ctl span{min-width:1.9rem;text-align:center;font-family:'Nunito',sans-serif;
  font-weight:700;font-size:1.05em}

/* wizard */
.progress{background:none;padding:.2rem .3rem;border-radius:0;box-shadow:none}
.progress__segs{display:flex;gap:.3rem;align-items:center}
.progress__seg{flex:1;height:5px;border-radius:999px;background:rgba(87,60,86,.16);
  transition:background .3s ease, box-shadow .3s ease}
.progress__seg--done{background:var(--rose)}
.progress__seg--now{background:var(--brick);box-shadow:0 0 0 3px rgba(180,71,34,.14)}
.progress__t{font-family:'Nunito',sans-serif;margin:.65rem 0 0;display:flex;gap:.5rem;
  align-items:baseline;flex-wrap:wrap}
.progress__n{font-weight:800;font-size:.82em;color:var(--brick);letter-spacing:.02em;
  text-transform:uppercase}
.progress__label{font-weight:700;font-size:.95em;color:var(--ink-2)}
.progress__bar span::after{content:"";position:absolute;left:6px;right:6px;top:2px;height:3px;
  border-radius:999px;background:rgba(255,255,255,.35)}
.wiz{display:flex;gap:.65rem;margin-top:1.6rem;flex-wrap:wrap;align-items:center}

/* Onboarding motion. Everything here respects prefers-reduced-motion at the
   bottom of this block — motion should help people understand where they are,
   not be imposed on someone who's asked their device not to. */
@keyframes stepIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.stepin{animation:stepIn .32s cubic-bezier(.22,.9,.3,1) both}

@keyframes recapIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.kitrecap{list-style:none;padding:0;margin:1.2rem 0 0;display:flex;flex-direction:column;gap:.7rem;
  background:none;border:none}
.kitrecap__i{background:var(--sunk);border-left:3px solid var(--brick);border-radius:4px 14px 14px 4px;
  padding:.85rem 1rem;line-height:1.5;animation:recapIn .4s cubic-bezier(.22,.9,.3,1) both}

/* Pinned so the tap target is in the same place on every step, regardless of
   how tall that step's content happens to be. */
.wizbar{position:fixed;left:0;right:0;bottom:0;z-index:26;padding:.7rem .9rem .85rem;
  height:104px;display:flex;flex-direction:column;justify-content:flex-start;
  background:linear-gradient(180deg,rgba(255,249,247,0),rgba(255,249,247,.97) 34%);
  backdrop-filter:blur(6px);box-sizing:border-box}
.wizbar__in{width:100%;max-width:720px;margin:0 auto;display:flex;gap:.65rem;align-items:center;
  box-sizing:border-box}
.wizbar__in .btn{flex:1}
.wizbar__in .btn--ghost{flex:0 0 auto}
.wizbar .hint--save{max-width:720px;margin:.45rem auto 0;text-align:center}
.wizbar__cap{margin:.45rem auto 0}
.dots{display:flex;gap:.45rem;justify-content:center;margin-top:1.1rem}
.dots__d{width:7px;height:7px;border-radius:999px;background:var(--rule);transition:all .3s ease}
.dots__d--on{background:var(--brick);width:22px}

/* The pinned bar floats over content, so the last step needs room to clear it
   or its final lines sit underneath and can't be read. */
.wiz-pad{padding-bottom:8.5rem}

.progress__bar span{transition:width .45s cubic-bezier(.22,.9,.3,1)}

@media(prefers-reduced-motion:reduce){
  .stepin,.recap__i{animation:none}
  .progress__bar span{transition:none}
}

/* recap */
.recap{background:var(--sunk);border:1px solid var(--rule);padding:1.15rem;margin-top:1.2rem;border-radius:18px}
.recap ul{margin:.5rem 0 .8rem;padding-left:1.3rem}
.recap li{padding:.15rem 0}
.recap__list{list-style:none;padding:0;margin:.8rem 0 0}
.recap__list li{display:flex;justify-content:space-between;gap:1rem;padding:.6rem 0;
  border-bottom:1px solid var(--rule);flex-wrap:wrap}
.recap__list span{color:var(--muted);font-family:'Nunito',sans-serif;font-size:.9em}
.recap__list strong{text-align:right}

/* ecosystem */
.eco__toggle{display:flex;align-items:center;justify-content:space-between;gap:1rem;width:100%;
  background:none;border:none;color:inherit;cursor:pointer;padding:0;min-height:48px;
  font-family:'Nunito',sans-serif;font-weight:700;font-size:1.28em;letter-spacing:-.02em;text-align:left}
.eco__toggle .fold__chev{color:inherit}
.card--dark-shut{padding-bottom:1.1rem}
.eco{list-style:none;margin:.9rem 0 0;padding:0}
.eco li{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;
  border-bottom:1px solid rgba(255,255,255,.18)}
.eco span{font-family:'Nunito',sans-serif;font-size:.9em;opacity:.75;flex:0 0 auto}
.eco strong{min-width:0;text-align:right;overflow-wrap:anywhere}
.eco__why{font-style:italic;margin-top:.9rem}

/* thread */
.thread{display:flex;flex-direction:column;gap:.7rem}
.bub{max-width:min(58ch,100%);padding:.85rem 1.05rem;border-radius:20px}
.bub p{margin:.2rem 0 0;white-space:pre-wrap}
.bub--mise{background:var(--surface);border:1px solid var(--rule);
  border-top-left-radius:7px;box-shadow:inset 3px 0 0 var(--rose), var(--shadow)}
.bub--me{background:var(--indigo);color:#F4F1F8;align-self:flex-end;border-bottom-right-radius:7px}
.bub__who{font-family:'Nunito',sans-serif;font-weight:650;font-size:.8em;color:var(--brick);
  letter-spacing:.02em}
.bub__can{font-size:.92em;color:var(--muted);font-style:italic}
.bub--me .bub__who{color:#B9C9C1}

/* dish cards */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.9rem}
.dish{background:var(--glass);-webkit-backdrop-filter:var(--glass-blur);
  backdrop-filter:var(--glass-blur);
  border:1px solid var(--glass-rim);border-radius:24px;
  padding:1.4rem 1.3rem;box-shadow:var(--spec), var(--lift-1);
  transition:transform .16s cubic-bezier(.3,.8,.4,1), box-shadow .16s ease, border-color .16s ease}
.dish:hover{border-color:rgba(238,146,101,.7);box-shadow:var(--spec), var(--lift-2);
  transform:translateY(-2px)}
.dish h3{font-size:1.24em}
.dish--yes{border-color:rgba(47,107,84,.65);background:rgba(214,240,227,.55);
  box-shadow:var(--spec), 0 2px 8px rgba(47,107,84,.14), 0 16px 40px -18px rgba(47,107,84,.5)}
.dish--no{opacity:.5}
.dish__b{font-size:1em}
.dish__why{color:var(--ink-2);font-style:italic}
.dish__meta{font-family:'Nunito',sans-serif;font-size:.86em;color:var(--blade)}
.dish__acts{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.9rem}
.dish__note{margin-top:.5rem}
.dish__more{display:flex;gap:1rem;flex-wrap:wrap;align-items:center}
.askmise{display:flex;gap:.85rem;align-items:center}
.askmise h2{font-size:1.1em}
.askmise p{margin:.15rem 0 0}
.rchat{display:flex;flex-direction:column;gap:.6rem;margin-top:1.2rem}
.opts{margin-top:1.3rem}
.opt{display:flex;flex-direction:column;gap:.25rem;width:100%;text-align:left;margin-top:.65rem;
  background:var(--surface);border:1px solid var(--rule-2);border-radius:18px;padding:1rem 1.15rem;
  cursor:pointer;color:var(--ink);min-height:60px;transition:border-color .12s ease, transform .12s ease}
.opt:hover{border-color:var(--brick);transform:translateY(-1px)}
.opt:active{transform:scale(.98)}
.opt--best{border-color:rgba(47,107,84,.5);background:linear-gradient(180deg,#F3FAF6,#fff 60%)}
.opt__lab{font-family:'Nunito',sans-serif;font-weight:700;font-size:1.02em}
.opt__lab em{color:var(--good);font-style:normal;font-weight:600;font-size:.86em}
.opt__what{font-size:.97em}
.opt__cost{font-size:.9em;color:var(--blade)}
.comp__l2{list-style:none;padding:0}
.comp__l2 li{display:flex;justify-content:space-between;align-items:center;gap:.6rem;
  padding:.45rem 0;border-bottom:1px solid var(--rule)}
.swapwrap{position:fixed;inset:0;z-index:40;background:rgba(26,27,36,.42);
  display:flex;align-items:flex-end;justify-content:center;padding:.6rem}
@media(min-width:640px){.swapwrap{align-items:center}}
.swapbox{background:var(--surface);border-radius:26px;padding:1.4rem 1.25rem;width:100%;
  max-width:460px;box-shadow:0 20px 60px rgba(26,27,36,.4);max-height:88vh;overflow-y:auto}
.swapbox__hd{display:flex;align-items:flex-start;gap:.8rem}
.swapbox__hd > div{flex:1;min-width:0}
.swapbox__hd h2{font-size:1.25em}
.swap{flex:0 0 auto;min-height:36px;padding:0 .8rem;background:var(--sunk);border:1px solid transparent;
  border-radius:999px;font-family:'Nunito',sans-serif;font-size:.8em;color:var(--plum);cursor:pointer}
.swap:hover{border-color:var(--brick);color:var(--brick)}

/* week */
.nights{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.9rem;margin-top:1.1rem}
.night{background:var(--sunk);border:none;padding:1.2rem;border-radius:18px}
.night__b{color:var(--ink-2);font-size:.95em}
.night__hd{display:flex;align-items:center;justify-content:space-between;gap:.6rem}
.count__ctl--sm button{width:36px;height:36px;font-size:1.1em}
.count__ctl--sm span{min-width:1.5rem;font-size:.95em}

/* shopping */
.sec{margin-top:1.4rem}
.sec h3{border-bottom:1px solid var(--rule);padding-bottom:.5rem;color:var(--plum);
  font-size:.92em;letter-spacing:.06em;text-transform:uppercase}
/* A shopping list is something you scan in an aisle, so the default row is one
   readable line and nothing else. Edit fields and actions appear on tap. That took
   each item from ~210px to ~56px — a 20-item list from 5 phone screens to about 1.5. */
.row2{border-bottom:1px solid var(--rule);display:grid;
  grid-template-columns:auto minmax(0,1fr);align-items:center}
.row2--off{opacity:.45}
.row2--off .row2__name{text-decoration:line-through}
.row2--open{background:var(--sunk);border-radius:14px;margin:.2rem 0;
  border-bottom-color:transparent}
.row2__tick{display:flex;align-items:center;justify-content:center;width:44px;min-height:52px;cursor:pointer}
.row2__tick input{width:24px;height:24px;accent-color:var(--good)}
.row2__face{display:flex;align-items:center;gap:.5rem;min-height:52px;padding:.55rem .5rem .55rem 0;
  background:none;border:none;text-align:left;cursor:pointer;color:inherit;width:100%;min-width:0}
.row2__text{flex:1;min-width:0;line-height:1.35;overflow-wrap:anywhere}
.row2__qty{font-family:'Nunito',sans-serif;font-weight:700;font-size:.92em;color:var(--plum);
  margin-right:.45rem;white-space:nowrap}
.row2__name{font-size:1em}
.row2__soon{flex:0 0 auto;font-family:'Nunito',sans-serif;font-size:.76em;font-weight:700;
  color:var(--warn);background:var(--warn-bg);padding:.2rem .5rem;border-radius:999px}
.row2__got{flex:0 0 auto;font-family:'Nunito',sans-serif;font-size:.76em;font-weight:700;
  color:var(--good)}
.row2__edit{grid-column:1/3;padding:.2rem .7rem .9rem}
.row2__fields{display:flex;gap:.45rem;align-items:flex-start}
.row2__inqty{flex:0 0 7rem;min-width:0}
.row2__inname{flex:1;min-width:0}
.row2__jobs{color:var(--muted);font-size:.86em;font-style:italic;margin:.5rem 0 0}
.row2__acts{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.7rem}

/* Three rows: tick + item name, then quantity, then the actions. Every track can
   shrink. Cramming quantity, name, shelf life and three buttons onto one line was
   what truncated the item names. */
.line{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.3rem .55rem;padding:.9rem 0;
  border-bottom:1px solid var(--rule);align-items:center}
.line--off{opacity:.5}
.line--off .line__item{text-decoration:line-through}
.line__tick{display:flex;align-items:center;justify-content:center;width:42px;min-height:44px;
  cursor:pointer;grid-row:1;grid-column:1;align-self:start}
.line__tick input{width:28px;height:28px;accent-color:var(--good)}
.line__item{grid-row:1;grid-column:2;min-width:0;font-size:1.02em}
.grow{resize:none;overflow:hidden;line-height:1.35;min-height:48px!important;
  padding:.6rem .8rem!important}
.line__meta{grid-row:2;grid-column:2;display:flex;gap:.45rem;align-items:center;min-width:0}
.line__qty{max-width:9rem;flex:0 1 auto}
.line__side{grid-row:3;grid-column:2;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;min-width:0}
.line input[type=text]{min-width:0;max-width:100%}
/* Only rendered when the item is actually near its limit — a shelf life on every
   row was the main thing making the list feel crowded. */
.line__days--soon{font-family:'Nunito',sans-serif;font-size:.8em;font-weight:650;
  color:var(--warn);background:var(--warn-bg);padding:.25rem .6rem;border-radius:999px;
  white-space:nowrap}
.line__have,.line__x{min-height:40px;padding:0 .8rem;background:var(--surface);
  border:1px solid var(--rule-2);font-family:'Nunito',sans-serif;font-size:.84em;
  cursor:pointer;color:var(--muted);border-radius:999px;white-space:nowrap}
.line__have--on{background:var(--good);color:#fff;border-color:var(--good)}
.line__swap{min-height:40px;padding:0 .8rem;background:var(--sunk);border:1px solid transparent;
  border-radius:999px;font-family:'Nunito',sans-serif;font-size:.84em;color:var(--plum);
  cursor:pointer;white-space:nowrap}
.line__swap:hover{border-color:var(--brick);color:var(--brick)}
.line__jobs{grid-row:4;grid-column:2;color:var(--muted);font-size:.86em;margin:.1rem 0 0;
  min-width:0;overflow-wrap:anywhere;font-style:italic}
.usefirst{margin:.7rem 0 0;padding-left:1.3rem}
.usefirst li{padding:.25rem 0}

/* recipe */
.learn{background:var(--sunk);border-left:4px solid var(--rose);padding:1rem 1.15rem;
  margin-top:1.3rem;border-radius:4px 16px 16px 4px}
.stale{background:var(--sunk);border:1px solid var(--rule);border-radius:16px;padding:1.15rem;margin-top:1.3rem}
.stale p{margin:0 0 .7rem}
.stale--warn{background:var(--warn-bg);border-color:var(--warn)}
/* A visible seam: everything below this is for after dinner, not before. */
.later{margin:2.6rem 0 -.4rem;border-top:2px dashed var(--rule-2);position:relative;height:0}
.later__tab{position:absolute;top:-.85rem;left:50%;transform:translateX(-50%);
  background:var(--paper);padding:0 .9rem;font-family:'Nunito',sans-serif;font-weight:600;
  font-size:.86em;color:var(--muted);white-space:nowrap}
.card--later{background:var(--sunk);box-shadow:none;border:1px solid var(--rule)}
.fold{padding:0;overflow:hidden}
.fold__hd{display:flex;align-items:center;justify-content:space-between;gap:1rem;width:100%;
  background:none;border:none;cursor:pointer;padding:1.25rem 1.35rem;text-align:left;min-height:68px}
.fold__t{display:flex;flex-direction:column;gap:.15rem;min-width:0}
.fold__h2{font-family:'Nunito',sans-serif;font-weight:700;font-size:1.28em;color:var(--navy);
  letter-spacing:-.02em}
.fold__note{font-size:.92em;color:var(--muted);font-style:italic}
.fold__chev{font-size:1.1em;color:var(--plum);flex:0 0 auto;transition:transform .16s ease}
.fold__chev--open{transform:rotate(180deg)}
.fold__body{padding:0 1.35rem 1.35rem}
.comp{margin-top:1rem}
.comp ul{margin:.4rem 0 0;padding-left:1.4rem}
.comp li{padding:.22rem 0}
/* Horizontal snap carousel. A ten-step recipe made the page endless vertically;
   this keeps the whole recipe one screen tall and swipeable. */
.sec-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
  margin-top:1.6rem;flex-wrap:wrap}
.hsteps{display:flex;gap:.8rem;overflow-x:auto;scroll-snap-type:x mandatory;
  list-style:none;margin:.9rem 0 0;padding:.2rem .2rem 1rem;-webkit-overflow-scrolling:touch}
.hstep{flex:0 0 min(88%,320px);scroll-snap-align:start;background:var(--surface);
  border:1px solid var(--rule);border-radius:18px;padding:1.1rem 1.15rem;
  display:flex;flex-direction:column;gap:.5rem;box-shadow:var(--shadow)}
.hstep--done{background:linear-gradient(180deg,#F3FAF6,#fff 50%);border-color:rgba(47,107,84,.4)}
.hstep__top{display:flex;justify-content:space-between;align-items:center;gap:.6rem}
.hstep__n{font-family:'Nunito',sans-serif;font-weight:700;font-size:1.5em;color:var(--rose)}
.hstep--done .hstep__n{color:var(--good)}
.hstep__tick{min-height:38px;padding:0 .8rem;background:none;border:1px solid var(--rule-2);
  border-radius:999px;font-family:'Nunito',sans-serif;font-size:.82em;color:var(--plum);cursor:pointer}
.hstep--done .hstep__tick{background:var(--good);border-color:var(--good);color:#fff}
.hstep__do{margin:0;font-size:1.06em;line-height:1.5}
.hstep__why{margin:0;font-style:italic;color:var(--ink-2);font-size:.95em;
  border-left:3px solid var(--rose);padding-left:.7rem}
.steps{margin:.9rem 0 0;padding:0;list-style:none}
.steps--plain{padding-left:1.4rem;list-style:decimal}
.steps--plain li{padding:.45rem 0}
.step{display:flex;gap:.95rem;padding:1.05rem 0;border-top:1px solid var(--rule)}
.step p{margin:0}
.step--done{opacity:.5}
.step__tick{flex:0 0 auto;width:46px;height:46px;border:1.5px solid var(--rule-2);background:var(--surface);
  font-family:'Nunito',sans-serif;font-weight:650;font-size:1em;cursor:pointer;border-radius:50%;
  color:var(--plum)}
.step--done .step__tick{background:var(--good);border-color:var(--good);color:#fff}
.step__why{font-style:italic;color:var(--ink-2);font-size:.94em;margin-top:.35rem!important}
.note{margin-top:1.1rem}
.note--done{background:var(--sunk);border-left:4px solid var(--good);padding:.85rem 1rem;
  border-radius:4px 14px 14px 4px}
.edit{margin-top:.6rem}

/* rating */
/* Stars, not buttons that contain stars. The boxed gradient version put a lot of
   chrome around a control whose whole job is to look like five stars. */
/* A real file input renders "Choose file — no file chosen" next to the button,
   which read as one confusing phrase. The input is visually hidden and this label
   drives it instead. */
.shotbtn{display:flex;flex-direction:column;gap:.15rem;align-items:flex-start;cursor:pointer;
  background:var(--surface);border:1px dashed var(--rule-2);border-radius:16px;
  padding:.85rem 1.1rem;min-height:60px;justify-content:center;
  font-family:'Nunito',sans-serif;font-weight:650;color:var(--plum);text-transform:none;
  letter-spacing:0;font-size:1em}
.shotbtn:hover{border-color:var(--brick);color:var(--brick)}
.shotbtn__sub{font-weight:400;font-size:.82em;color:var(--muted)}
.photo__err{color:var(--brick);font-size:.92em}
.shots{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem}
.shot{position:relative}
.shot img{width:96px;height:96px;object-fit:cover;border-radius:14px;border:1px solid var(--rule)}
.shot button{position:absolute;top:-6px;right:-6px;width:26px;height:26px;border-radius:50%;
  border:none;background:var(--brick);color:#fff;cursor:pointer;font-size:1em;line-height:1}
.shots--sm img{width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--rule)}
.stars{display:flex;gap:.1rem;margin-top:.9rem;flex-wrap:wrap}
.star{display:flex;align-items:center;justify-content:center;
  width:50px;height:50px;background:none;border:none;padding:0;
  font-size:1.85em;line-height:1;cursor:pointer;color:var(--rule-2);
  transition:color .12s ease, transform .12s ease}
.star:hover{color:var(--rose);transform:scale(1.08)}
.star:active{transform:scale(.92)}
.star--on{color:var(--brick)}
.star--on:hover{color:var(--brick)}
.star:focus-visible{border-radius:12px}

/* ---- history ---- */
.hist--current{border-color:rgba(180,71,34,.4)}
.hist__dishes{list-style:none;padding:0;margin:1.1rem 0 0}
.hist__dishes li{padding:1rem 0;border-top:1px solid var(--rule);display:flex;
  flex-direction:column;gap:.45rem;align-items:flex-start}
.hist__blurb{color:var(--muted);font-weight:400}
.hist__rating{margin-top:.25rem;font-size:1.05em;letter-spacing:.1em;color:var(--brick)}
.hist__dim{color:var(--rule-2)}
.hist__when{margin-left:.5rem;font-family:'Nunito',sans-serif;font-size:.8em;color:var(--muted)}
.hist__tag{display:inline-block;margin-left:.5rem;background:var(--sunk);color:var(--plum);
  font-family:'Nunito',sans-serif;font-size:.72em;font-weight:650;letter-spacing:.04em;
  text-transform:uppercase;padding:.18rem .5rem;border-radius:999px;vertical-align:middle}
.hist__unrated{font-family:'Nunito',sans-serif;font-size:.82em;color:var(--muted);
  letter-spacing:.04em;text-transform:uppercase}
.hist__note{color:var(--plum);font-style:italic;font-size:.94em;margin-top:.3rem}

/* leftovers + favourites */
.left__meta{font-family:'Nunito',sans-serif;font-size:.88em;color:var(--blade)}
.left__need{color:var(--warn);font-size:.95em}
.left__uses{font-size:.95em}
.left__warn{color:var(--hot);font-weight:600;font-size:.95em}
.skel{list-style:none;padding:0;margin:1rem 0 0}
.skel li{padding:.3rem 0}
@keyframes shimmer{0%{background-position:-320px 0}100%{background-position:320px 0}}
/* Standalone placeholder utility — deliberately NOT scoped to a parent
   container. Coupling the shimmer to a ".dcard *" descendant selector was the
   actual bug: any placeholder used outside a literal .dcard silently got no
   display:block and no animation, rendering as an invisible zero-size <span>.
   Every skeleton in the app composes from this one rule now, nested or not. */
.ph{display:block;border-radius:999px;
  background:linear-gradient(90deg,var(--sunk) 25%,rgba(255,255,255,.85) 50%,var(--sunk) 75%);
  background-size:640px 100%;animation:shimmer 1.6s ease-in-out infinite}
.skel li span{height:1.1em}
@media(prefers-reduced-motion:reduce){.ph{animation:none}}

/* Dish-card-shaped skeleton for Ideas — the first, most important AI-wait moment
   in the app previously had no skeleton at all, just the generic bottom spinner
   over an empty screen. Mimics the real .dish card's proportions. */
/* Asymmetric on purpose: a two-column base with tiles that span one or both
   columns, so short values (a number) and long ones (a list of nights) each
   get appropriate room instead of every row being the same shape. */
.histrate{margin-top:.9rem;padding:1rem;background:var(--sunk);border-radius:18px;
  border:1px solid var(--rule)}
.histrate .stars{margin-bottom:.6rem}
/* The physical surface the glass sits on. Fixed and behind everything, so
   scrolling never repaints it — only a transform moves it, and transforms are
   composited.

   Two levers here, and it matters which does what. This took several passes,
   because the obvious lever is the wrong one:

   - brightness() is what makes it bright. marble.webp measures 79% luminance
     (RGB 203,201,200, stddev 5.2) — pale, almost featureless stone that still
     reads grey against #FAF5F4 paper. Weakening the gradients to "show more
     marble" moves the composite DOWN (215 -> 208): more stone, less light,
     darker room. Multiplying the layer lifts the stone itself, which is the
     thing that was never bright enough. 1.12 lands near 227 against paper's
     246: clearly lit, still obviously stone.
   - DAYLIGHT_SOFT is only the tint, at 9-12% — so the marble is ~90% of what
     you see. It uses saturated colours rather than the auth pages' near-white
     ones, because near-white at low alpha over pale stone is invisible (1.6
     points of blue-red spread, measured). See its own note in authStyles.js.

   If it needs to go further, brightness is the dial. Raising the alphas
   instead just veils the stone again, which is the whole problem. */
.surface{position:fixed;inset:-8% 0 -8% 0;z-index:-1;pointer-events:none;
  background-image:${DAYLIGHT_SOFT},url('/textures/marble.webp');
  background-size:cover;background-position:center;
  background-color:var(--paper);
  filter:brightness(1.12) saturate(1.04);
  transform:translate3d(0,var(--par,0px),0);
  will-change:transform}
/* Cook mode: the same daylight, no photographic texture under it.
   It had linen — a cloth on the counter rather than the counter — and it read
   as noise exactly where noise costs the most. This is the one screen you read
   at arm's length, mid-task, hands busy, possibly with steam between you and
   the phone, and the step type is set large for that reason. A fabric weave
   sitting behind 2em text fights it at the same visual frequency.
   So: identical light, so it's unmistakably the same room, over a plain pale
   ground instead of cloth. Stays light because cook mode sets navy text on it.
   Also one fewer image request on the screen most likely to be opened on bad
   kitchen wifi.

   Full DAYLIGHT, not the soft variant: there's no stone here to show through,
   so the gradients are the whole picture and want their real strength. And
   filter:none because .surface's brightness lift exists to raise a grey stone
   layer — applied to an already-pale gradient it just clips toward white. */
.cook .surface,.surface--linen{background-image:${DAYLIGHT},
    linear-gradient(178deg, #FBF7F6 0%, #F2ECEB 100%);
  background-color:var(--paper);
  filter:none}
@media(prefers-reduced-motion:reduce){.surface{transform:none;will-change:auto}}

/* Photographs, not icons. Rounded to match the glass panels they sit inside,
   and capped in height so a tall image can't push the actual message off a
   short screen. */
.empty__art{margin:0 auto 1.1rem;max-width:280px}
.empty__art img{width:100%;height:auto;max-height:200px;object-fit:cover;
  border-radius:20px;display:block;box-shadow:var(--lift-1)}
.introart{margin:0 auto;max-width:300px}
.introart img{width:100%;height:auto;max-height:230px;object-fit:cover;
  border-radius:24px;display:block;box-shadow:var(--lift-2)}

.advlink{display:block;width:100%;margin:.4rem 0 0;padding:.7rem;background:none;border:none;
  font-family:'Nunito',sans-serif;font-weight:700;font-size:.86em;color:var(--muted);
  cursor:pointer;text-align:center;border-radius:14px}
.advlink:hover{color:var(--plum);background:rgba(87,60,86,.05)}
/* The spice photo sits behind the seed card at low opacity and is masked to
   fade out toward the text, so the tradition and vegetable stay readable. It's
   atmosphere, not an illustration of the specific cuisine drawn — 53 traditions
   can't each have their own photo, and one generic image is honest about that. */
.seed{position:relative;overflow:hidden;background:var(--glass-strong);border:1px solid var(--rule-2);border-radius:18px;
  padding:.9rem 1rem;margin-bottom:1rem;box-shadow:var(--spec)}
.seed__art{position:absolute;inset:0;background-image:url('/img/spices.webp');
  background-size:cover;background-position:center;opacity:.16;
  mask-image:linear-gradient(to right,rgba(0,0,0,.9),transparent 78%);
  -webkit-mask-image:linear-gradient(to right,rgba(0,0,0,.9),transparent 78%);
  pointer-events:none}
.seed__row{position:relative;display:flex;justify-content:space-between;align-items:center;gap:.6rem}
.seed__k{font-family:'Nunito',sans-serif;font-weight:800;font-size:.72em;letter-spacing:.06em;
  text-transform:uppercase;color:var(--brick)}
.seed__re{background:none;border:1px solid var(--rule-2);border-radius:999px;
  padding:.25rem .7rem;font-family:'Nunito',sans-serif;font-weight:700;font-size:.8em;
  color:var(--plum);cursor:pointer}
.seed__re:disabled{opacity:.45;cursor:not-allowed}
.seed__v{position:relative;margin:.45rem 0 0;font-size:1.05em}
.seed__t{position:relative;margin:.3rem 0 0;font-size:.9em;color:var(--muted);font-style:italic}
.setg{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:1.1rem}
.setg__t{background:var(--glass-strong);border:1px solid var(--rule-2);border-radius:16px;
  padding:.75rem .9rem;display:flex;flex-direction:column;gap:.15rem;min-width:0;
  box-shadow:var(--spec)}
.setg__t--full{grid-column:1 / -1}
/* Fills the hole left beside a half-width tile at narrow sizes; at wider
   sizes the three-column rule below takes over and it sits normally. */
@media(max-width:559px){.setg__t--wide{grid-column:1 / -1}}
.setg__k{font-family:'Nunito',sans-serif;font-weight:800;font-size:.72em;letter-spacing:.06em;
  text-transform:uppercase;color:var(--brick);
  /* A key should never hyphenate or split mid-word — it's a label, not prose. */
  word-break:keep-all;overflow-wrap:normal;hyphens:none}
/* Tiles in a row match height so a tall neighbour doesn't leave dead space. */
.setg__t{align-self:stretch}
.setg__v{font-family:'Nunito',sans-serif;font-weight:800;font-size:1.7em;line-height:1.1;
  color:var(--navy)}
.setg__v--sm{font-size:1em;font-weight:700;line-height:1.35;color:var(--ink-2);
  overflow-wrap:anywhere}
@media(min-width:560px){
  .setg{grid-template-columns:repeat(3,1fr)}
  .setg__t--wide{grid-column:span 1}
}

.dcards{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-top:1rem}
.dcard{background:var(--surface);border:1px solid var(--rule);border-radius:20px;
  padding:1.4rem 1.3rem;box-shadow:var(--shadow)}
.dcard__title{height:1.24em;width:72%;margin-bottom:.7rem}
.dcard__line{height:.9em;width:100%;margin-bottom:.4rem}
.dcard__line--short{height:.9em;width:58%;margin-bottom:.9rem}
.dcard__acts{display:flex;gap:.4rem;margin-top:.9rem}
.dcard__pill{height:2.4em;border-radius:999px;flex:0 0 auto}
.dcard__pill--a{width:5.5rem}
.dcard__pill--b{width:7.5rem}
.left__rec{margin-top:1.1rem;border-top:1px solid var(--rule);padding-top:.9rem}
.fav{display:flex;justify-content:space-between;gap:1rem;padding:1.1rem 0;
  border-bottom:1px solid var(--rule);flex-wrap:wrap}
.fav__meta{color:var(--blade);font-size:.92em}
.fav__acts{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}

/* sous chef */


/* ---- Cook Mode: bright, warm, and meant to make you want to start ----
   Previously this was near-black, argued for on glare grounds. That reads as a
   dashboard, not a kitchen. Warm paper, big confident type and rose accents do
   the glare job well enough while actually feeling like somewhere you'd want to
   spend forty minutes. */
.cook{position:fixed;inset:0;z-index:25;overflow-y:auto;display:flex;flex-direction:column;
  color:var(--ink);-webkit-overflow-scrolling:touch;
  background:#FFF9F7;
  background-image:
    radial-gradient(90% 55% at 12% -8%, rgba(216,126,121,.30), transparent 62%),
    radial-gradient(70% 45% at 96% 4%, rgba(60,63,99,.14), transparent 60%),
    radial-gradient(80% 40% at 50% 104%, rgba(216,126,121,.18), transparent 65%);
  background-attachment:fixed}

.cook__top{flex:0 0 auto;display:flex;align-items:center;gap:.8rem;padding:.85rem 1rem;
  position:sticky;top:0;z-index:3;background:rgba(255,249,247,.86);backdrop-filter:blur(12px);
  border-bottom:1px solid var(--rule)}
.cook__title{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
.cook__title strong{font-family:'Nunito',sans-serif;font-size:1.02em;color:var(--navy);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cook__title span{font-size:.85em;color:var(--muted)}
.cook__exit,.cook__vox{min-height:46px;padding:0 1rem;background:var(--surface);
  border:1px solid var(--rule-2);color:var(--plum);font-family:'Nunito',sans-serif;
  font-weight:650;font-size:.9em;cursor:pointer;border-radius:999px;flex:0 0 auto}
.cook__vox--on{background:var(--brick);border-color:var(--brick);color:#fff}
.cook__vox--na{border-style:dashed;color:var(--muted);display:flex;align-items:center}

.cook__body{padding:1.6rem 1.15rem 9.5rem;max-width:720px;margin:0 auto;width:100%;flex:1}
.cook__body--mid{display:flex;flex-direction:column;align-items:center;text-align:center;
  justify-content:center;gap:.6rem}

.cook__kicker{font-family:'Nunito',sans-serif;font-weight:700;font-size:.92em;color:var(--brick);
  text-transform:uppercase;letter-spacing:.1em;margin:0}
.cook__h{font-size:2.1em;margin-top:.35rem;color:var(--navy);letter-spacing:-.03em}
.cook__lead{color:var(--ink-2);max-width:46ch;font-size:1.05em}

.cook__prog{margin-bottom:1.6rem}
.cook__bar{height:8px;background:rgba(87,60,86,.12);margin-top:.6rem;border-radius:999px;overflow:hidden}
.cook__bar span{display:block;height:100%;border-radius:999px;
  background:linear-gradient(90deg,var(--rose),var(--brick))}

/* The step itself: a big warm card, the largest thing on screen by far. */
.cook__step{font-size:1.95em;line-height:1.34;margin:0;color:var(--navy);letter-spacing:-.02em;
  background:var(--surface);border:1px solid var(--rule);border-radius:26px;
  padding:1.6rem 1.5rem;box-shadow:0 2px 4px rgba(30,20,30,.04), 0 22px 50px -22px rgba(180,71,34,.4)}
.cook__why{font-size:1.06em;color:var(--ink-2);font-style:italic;
  border-left:3px solid var(--rose);padding-left:1rem;margin-top:1.2rem}

.cook__acts{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1.7rem}
.cbtn{min-height:52px;padding:0 1.2rem;background:var(--surface);border:1px solid var(--rule-2);
  color:var(--plum);font-family:'Nunito',sans-serif;font-weight:650;font-size:.95em;
  cursor:pointer;border-radius:999px;transition:transform .12s ease}
.cbtn:hover{transform:translateY(-1px);border-color:var(--brick);color:var(--brick)}
.cbtn:active{transform:scale(.96)}
.cbtn--hot{background:var(--brick);border-color:var(--brick);color:#fff}
.cbtn--hot:hover{color:#fff}
.cbtn--live{animation:live 1.2s infinite}

.cook__nav{display:flex;gap:.7rem;margin-top:2rem;flex-wrap:wrap}
.cook__nav .btn{flex:1 1 auto;min-height:66px;font-size:1.08em}

/* The bubble is fixed to the viewport and this row scrolls under it, so the row
   needs its own right-hand gutter rather than relying on the body's padding. */
.cook__opts{margin-top:1.8rem;display:flex;flex-direction:column;gap:.5rem;
  align-items:flex-start;padding-right:11rem}
@media(max-width:560px){.cook__opts{padding-right:0;padding-bottom:4.5rem}}
.cook__check{display:flex;gap:.6rem;align-items:center;min-height:48px;cursor:pointer;color:var(--ink-2)}
.cook__check input{width:26px;height:26px;accent-color:var(--brick)}
.cook__checknote{display:block;font-size:.86em;color:var(--muted);font-style:italic}
.linkish--light{color:var(--plum)}

.cook__all{margin:1rem 0 0;padding:0;list-style:none;border-top:1px solid var(--rule)}
.cook__all li{border-bottom:1px solid var(--rule)}
.cook__all button{display:flex;gap:.8rem;width:100%;text-align:left;background:none;border:none;
  color:var(--ink-2);padding:1rem .2rem;font-family:'Nunito',sans-serif;font-size:1em;
  cursor:pointer;min-height:54px}
.cook__all li.on button{color:var(--navy);font-weight:600}
.cook__all button span{font-family:'Nunito',sans-serif;font-weight:700;color:var(--brick);flex:0 0 1.6rem}

/* prep checklist */
.prepbar{position:fixed;left:0;right:0;bottom:0;z-index:26;padding:.7rem .9rem 1rem;
  background:linear-gradient(180deg,rgba(255,249,247,0),rgba(255,249,247,.96) 38%);
  backdrop-filter:blur(6px)}
.prepbar__in{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:.9rem;
  background:var(--surface);border:1px solid var(--rule);border-radius:999px;
  padding:.45rem .5rem .45rem 1.3rem;box-shadow:0 10px 30px -12px rgba(87,60,86,.45)}
.prepbar__count{flex:1;min-width:0;font-family:'Nunito',sans-serif;font-weight:600;
  font-size:.94em;color:var(--muted)}
.prepbar .btn{flex:0 0 auto}
.prep{list-style:none;margin:1.4rem 0 0;padding:0;display:flex;flex-direction:column;gap:.55rem}
.prep__b{display:flex;align-items:center;gap:.9rem;width:100%;text-align:left;min-height:64px;
  padding:.85rem 1.1rem;background:var(--surface);border:1px solid var(--rule);border-radius:18px;
  color:var(--ink);font-family:'Nunito',sans-serif;font-size:1.08em;cursor:pointer;
  box-shadow:var(--shadow);transition:transform .12s ease}
.prep__b:hover{transform:translateX(2px)}
.prep__b:active{transform:scale(.98)}
.prep__b--on{background:linear-gradient(180deg,#F1FAF4,#fff 55%);border-color:rgba(47,107,84,.45);
  color:var(--good)}
.prep__b em{color:var(--muted);font-size:.86em;font-style:normal}
.prep__tick{flex:0 0 32px;height:32px;border:2px solid var(--rule-2);border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;font-weight:800}
.prep__b--on .prep__tick{background:var(--good);border-color:var(--good);color:#fff}

/* timers */
.ctimers{flex:0 0 auto;display:flex;gap:.55rem;overflow-x:auto;padding:.75rem 1rem;
  background:rgba(255,255,255,.7);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--rule);position:sticky;top:66px;z-index:2;
  align-items:flex-start}
/* An open timer needs a whole line — squeezing five buttons into a chip inside a
   horizontal scroller pushed it out of the row and over the content below. Driven
   by a class rather than :has(), so it doesn't depend on selector support. */
.ctimers--open{flex-wrap:wrap;overflow-x:visible}
.ctimers--open .ctimer{flex:1 1 100%}
.ctimer{flex:0 0 auto;background:var(--surface);border:1px solid var(--rule-2);
  border-radius:999px;box-shadow:var(--shadow);overflow:hidden;transition:border-radius .12s ease}
.ctimer--open{border-radius:22px;border-color:var(--brick)}
.ctimer--done{border-color:var(--brick);background:#FBEAE8;animation:live 1s infinite}
.ctimer--paused{border-style:dashed;opacity:.85}
.ctimer--paused .ctimer__clock{color:var(--muted)}
.ctimer__face{display:flex;align-items:center;gap:.6rem;min-height:48px;padding:.3rem 1.1rem;
  background:none;border:none;cursor:pointer;width:100%;text-align:left;color:inherit}
.ctimer__ctl{display:flex;gap:.3rem;padding:.15rem .45rem .5rem;flex-wrap:wrap}
.ctimer__ctl button{min-height:42px;padding:0 .8rem;border-radius:999px;cursor:pointer;
  background:var(--sunk);border:1px solid var(--rule);color:var(--plum);
  font-family:'Nunito',sans-serif;font-weight:650;font-size:.85em;white-space:nowrap}
.ctimer__ctl button:hover{border-color:var(--brick);color:var(--brick)}
.ctimer__del{color:var(--brick)!important}
.ctimer__clock{font-family:'Nunito',sans-serif;font-weight:800;font-size:1.25em;
  font-variant-numeric:tabular-nums;color:var(--navy)}
.ctimer--done .ctimer__clock{color:var(--brick)}
.ctimer__lab{font-size:.86em;color:var(--muted)}

.ctimer__clear{flex:0 0 auto;min-height:46px;padding:0 1rem;background:none;
  border:1px dashed var(--rule-2);color:var(--plum);border-radius:999px;
  font-family:'Nunito',sans-serif;cursor:pointer}
.cook__ding{flex:0 0 auto;margin:1rem;padding:1.15rem 1.3rem;background:var(--brick);color:#fff;
  border-radius:20px;display:flex;justify-content:space-between;align-items:center;gap:1rem;
  flex-wrap:wrap;box-shadow:0 14px 34px -14px rgba(180,71,34,.8)}
.cook__ding p{margin:0}
.cook__ding-acts{display:flex;gap:.5rem;flex-wrap:wrap}
.cook__ding button{min-height:48px;padding:0 1.1rem;background:rgba(255,255,255,.16);
  border:1px solid rgba(255,255,255,.5);color:#fff;font-family:'Nunito',sans-serif;
  font-weight:650;cursor:pointer;border-radius:999px}

/* Mise, hovering */
.cbubble{position:fixed;right:1rem;bottom:1.1rem;z-index:28;display:flex;align-items:center;
  gap:.6rem;padding:.45rem 1.25rem .45rem .5rem;border:none;border-radius:999px;cursor:pointer;
  background:linear-gradient(140deg,var(--brick),#8E3417);color:#fff;min-height:62px;
  font-family:'Nunito',sans-serif;font-weight:700;font-size:1em;
  box-shadow:0 14px 34px -10px rgba(180,71,34,.75);transition:transform .12s ease}
.cbubble:hover{transform:translateY(-2px)}
.cbubble:active{transform:scale(.95)}
.cbubble__av{display:flex;background:#fff;border-radius:50%;padding:3px}
.cbubble__av .mise-av{color:var(--navy)}

.cask{position:fixed;left:.6rem;right:.6rem;bottom:.6rem;z-index:28;background:var(--surface);
  border:1px solid var(--rule);border-radius:26px;padding:1.1rem;
  box-shadow:0 -8px 50px rgba(87,60,86,.28)}
@media(min-width:720px){.cask{left:auto;width:450px}}
.cask__hd{display:flex;align-items:center;gap:.75rem}
.cask__hd strong{display:block;font-family:'Nunito',sans-serif;font-size:1.08em;color:var(--navy)}
.cask__hd span{font-size:.86em;color:var(--muted)}
.cask__hd > div{flex:1;min-width:0}
.cask__plate{display:flex;background:var(--sunk);border-radius:50%;padding:4px;flex:0 0 auto}
.cask__plate .mise-av{color:var(--navy)}
/* A button's default vertical alignment leaves the label sitting slightly off
   centre once a min-height is applied — flex centring puts it dead centre. */
.cask__x{min-height:44px;padding:0 1.1rem;background:var(--sunk);border:1px solid var(--rule);
  color:var(--plum);border-radius:999px;cursor:pointer;font-family:'Nunito',sans-serif;
  font-size:.88em;font-weight:700;display:inline-flex;align-items:center;justify-content:center;
  line-height:1}
.cask__say{background:var(--sunk);padding:.9rem 1.05rem;margin:.95rem 0 0;border-radius:20px;
  border-top-left-radius:7px;box-shadow:inset 3px 0 0 var(--rose);font-size:1em}
.cask__qs{display:flex;gap:.45rem;overflow-x:auto;padding:.95rem 0 .2rem}
.cask__foot{display:flex;gap:.45rem;align-items:center;margin-top:.75rem}
.cask__foot input{flex:1;min-width:0;border-radius:999px!important;padding:.7rem 1.05rem!important;
  min-height:50px}

/* the finish screen should feel like an occasion */
.cook__done-badge{width:118px;height:118px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;background:linear-gradient(150deg,#FBEAE8,#fff);
  border:1px solid var(--rule);box-shadow:0 18px 44px -18px rgba(180,71,34,.55);margin-bottom:.4rem}
.cook__done-badge .mise-av{color:var(--navy)}
.cook__stats{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap;margin-top:1.1rem}
.cook__stat{background:var(--surface);border:1px solid var(--rule);border-radius:16px;
  padding:.7rem 1.1rem;min-width:96px}
.cook__stat b{display:block;font-family:'Nunito',sans-serif;font-size:1.5em;color:var(--brick)}
.cook__stat span{font-size:.85em;color:var(--muted);font-family:'Nunito',sans-serif}

@media print{.cook{display:none!important}}
@media(max-width:560px){
  .cook__step{font-size:1.55em;padding:1.3rem 1.2rem}
  .prepbar__in{padding-left:1rem}
  .cook__h{font-size:1.7em}
  .ctimers{top:62px}
}

/* ---- Mise the character ---- */
.mise-av{color:var(--ink);flex:0 0 auto;display:block}
.mise-av--worried{color:var(--brick)}
.mise-av__steam{animation:steam 2.4s ease-in-out infinite}
@keyframes steam{0%,100%{opacity:.2;transform:translateY(1px)}50%{opacity:.7;transform:translateY(-2px)}}
.says{display:flex;gap:.55rem;align-items:flex-start;max-width:min(58ch,100%)}
.says .mise-av{margin-top:.15rem}
.says .bub--mise{position:relative;flex:1 1 auto}
/* The notched top-left corner points back at her — a triangle tail fights a
   20px radius and ends up looking like a defect. */
.bub--wait{display:flex;align-items:center;min-height:46px;border-radius:20px;border-top-left-radius:7px}
.sheet__id{display:flex;align-items:center;gap:.7rem}
/* She sits on a light plate in the dark header — her fills are near-white, so
   recolouring the strokes to match would flatten her into a silhouette. */
.sheet__id .mise-av{color:var(--ink)}
.sheet__plate{display:flex;background:var(--card);border-radius:50%;padding:4px;flex:0 0 auto}
.sheet__id .sheet__name{display:block}
.sheet__id .sheet__role{display:block;margin-left:0;margin-top:.1rem}
.fab{display:flex;align-items:center;gap:.55rem;padding:.55rem 1.05rem .55rem .6rem}
.fab__av{display:flex;background:var(--card);border-radius:50%;padding:3px;flex:0 0 auto}
.fab__av .mise-av{color:var(--ink)}
.fab{position:fixed;right:1rem;bottom:1rem;z-index:20;
  background:linear-gradient(140deg,var(--brick),#8E3417);color:#fff;
  border:none;border-radius:999px;padding:.5rem 1.35rem .5rem .5rem;min-height:64px;
  cursor:pointer;font-family:'Nunito',sans-serif;font-weight:700;font-size:1em;
  box-shadow:0 10px 30px -8px rgba(180,71,34,.65);transition:transform .12s ease}
.fab:hover{transform:translateY(-2px)}
.fab:active{transform:scale(.95)}
.sheet{position:fixed;inset:auto .5rem 0 .5rem;z-index:30;background:var(--surface);
  display:flex;flex-direction:column;max-height:88vh;overflow:hidden;
  border-radius:26px 26px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.28)}
@media(min-width:760px){.sheet{inset:auto 1rem 1rem auto;width:470px;max-height:78vh;
  border-radius:26px}}
.sheet__hdr{display:flex;justify-content:space-between;align-items:center;gap:1rem;
  padding:.9rem 1.1rem;background:var(--indigo);color:#F4F1F8;
  border-radius:24px 24px 0 0}
@media(min-width:760px){.sheet__hdr{border-radius:22px 22px 0 0}}
.sheet__name{font-family:'Nunito',sans-serif;font-weight:800;font-size:1.2em}
.sheet__role{font-family:'Nunito',sans-serif;font-size:.85em;opacity:.8;margin-left:.6rem}
.sheet__x{min-height:46px;padding:0 1rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.28);
  color:#F4F1F8;font-family:'Nunito',sans-serif;font-weight:600;font-size:.92em;cursor:pointer;
  border-radius:999px}
.sheet__body{overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.7rem;flex:1}
.sheet__hint{color:var(--muted);margin:0}
.sheet__quick{display:flex;gap:.4rem;overflow-x:auto;padding:.6rem 1rem;border-top:1px solid var(--rule)}
.quick{flex:0 0 auto;min-height:46px;padding:0 .95rem;background:var(--sunk);
  border:1px solid transparent;font-family:'Nunito',sans-serif;font-size:.92em;
  cursor:pointer;color:var(--plum);border-radius:999px}
.quick:hover{border-color:var(--rule-2)}
.sheet__foot{display:flex;gap:.5rem;padding:.8rem 1rem 1.1rem;border-top:1px solid var(--rule);align-items:center}
.sheet__foot input[type=text]{border-radius:999px;padding:.7rem 1.05rem}
.sheet__foot .btn{border-radius:999px}
.sheet__body{border-radius:0}
.sheet__x{border-radius:999px}

/* states */
.empty{background:var(--surface);border:1px dashed var(--rule-2);padding:2.8rem 1.4rem;
  text-align:center;border-radius:24px;box-shadow:var(--shadow)}
.empty__b{margin-top:.6rem;display:flex;flex-direction:column;gap:1rem;align-items:center}
/* Floats above the page instead of pushing content down when it appears or
   is dismissed — top-anchored so it doesn't collide with the bottom-docked
   sous-chef bubble, prep bar and busy indicator. */
.alert{position:fixed;top:.6rem;left:.6rem;right:.6rem;z-index:21;max-width:920px;margin:0 auto;
  padding:1rem 1.25rem;background:var(--brick);color:#fff;
  display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap;
  border-radius:16px;box-shadow:var(--shadow-lift);animation:surfaceDown .22s ease-out}
.alert p{margin:0}
.alert .btn--ghost{background:transparent;color:#fff;border-color:#fff}
.working{display:flex;align-items:center;gap:.6rem;font-family:'Nunito',sans-serif;
  font-weight:600;color:var(--ink-2);margin:0}
.working__dots{display:inline-flex;gap:4px}
.working__dots i{width:7px;height:7px;background:var(--rose);border-radius:50%;animation:p 1.1s infinite}
.working__dots i:nth-child(2){animation-delay:.16s}
.working__dots i:nth-child(3){animation-delay:.32s}
@keyframes p{0%,100%{opacity:.25}50%{opacity:1}}
.busybar{position:fixed;left:.6rem;right:.6rem;bottom:.6rem;background:var(--indigo);
  padding:.9rem 1.25rem;z-index:22;border-radius:16px;box-shadow:var(--shadow-lift)}
.busybar .working{color:#F2EFF6}

@media(max-width:560px){
  .hdr__logo{font-size:1.8em}
  .cards,.nights{grid-template-columns:1fr}
  /* Was flex-direction:column here, which stacked every card heading and its
     button on phones — and it overrode the flex rules above, which is why
     shrinking the heading had no effect. A heading plus one small button fits
     comfortably at this width (measured 271px of content in 332px), so it only
     needs to wrap if it genuinely runs out of room. */
  .card__head{flex-wrap:wrap}
  .recap__list li{flex-direction:column;gap:.1rem}
  .recap__list strong{text-align:left}
}
`;
