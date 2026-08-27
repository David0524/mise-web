// Run this first, before anything else. It calls the exact same provider
// module the app uses — lib/providers/gemini.js — with your real key, with
// no database and no running server involved. If this works, the wiring is
// correct and any problem you hit later is somewhere else, not here.
//
// Usage:
//   cd mise-web
//   GEMINI_API_KEY=your-real-key node scripts/test-gemini.mjs

import { callModel } from "../lib/providers/gemini.js";

if (!process.env.GEMINI_API_KEY) {
  console.error("Set GEMINI_API_KEY first, e.g.:");
  console.error("  GEMINI_API_KEY=your-key node scripts/test-gemini.mjs");
  process.exit(1);
}

const doctrine = "You are Mise, a cooking collaborator. Be warm and brief.";
const messages = [
  { role: "user", content: "In one short sentence, suggest a dinner using zucchini." },
];

console.log("Calling Gemini with your real key...\n");

try {
  const start = Date.now();
  const text = await callModel(messages, doctrine, { tier: "fast", maxTokens: 200 });
  console.log(`✓ Got a real response in ${Date.now() - start}ms:\n`);
  console.log(text);
  console.log("\nThe wiring works. If the full app still misbehaves, the problem");
  console.log("is elsewhere — auth, storage, or a specific prompt — not this.");
} catch (e) {
  console.error("✗ Call failed:", e.message);
  console.error("\nCommon causes:");
  console.error("  - GEMINI_API_KEY is wrong or missing a real value");
  console.error("  - The model name in lib/providers/gemini.js isn't live on your");
  console.error("    account — check aistudio.google.com and swap it in if not");
  console.error("  - You've hit the free tier's rate limit (5-15 requests/min)");
}
