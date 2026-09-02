import slices from "./doctrine.json";

// Same source as the artifact: weekly-cooking-collaborator/SKILL.md, compiled
// by build_doctrine.py. Regenerate with:
//   python3 build_doctrine.py <path-to-artifact.jsx> lib/doctrine.json

// Kept for anything that genuinely wants everything (and as the safe default
// below if a caller passes an empty/unknown slice list — better to over-send
// than to silently run a call with no doctrine at all).
export const DOCTRINE_ALL = [slices.core, slices.groceries, slices.flavor]
  .filter(Boolean)
  .join("\n\n---\n\n");

/* build_doctrine.py's own header says it plainly: "Doctrine is emitted as
   SLICES... The app injects only the slices a given call needs." That never
   actually happened here — every call site sent DOCTRINE_ALL regardless of
   what it was doing, which meant a trivial cook-mode question ("what's
   happening in the pan?") paid for ~2,900 tokens of grocery-list and
   flavor-architecture doctrine it had no use for. On Anthropic that's masked
   by prompt caching; on Gemini there is no caching at this app doesn't
   implement one, so every one of those tokens is fully reprocessed, on every
   call, adding real latency on top of an already-tight per-request timeout.

   `core` is the chef's voice and general judgment — every call needs it.
   `groceries` and `flavor` are added only when the call actually touches
   shopping or dish composition. */
export function buildDoctrine(names) {
  const list = Array.isArray(names) && names.length ? names : ["core", "groceries", "flavor"];
  const picked = list.map((n) => slices[n]).filter(Boolean);
  return picked.length ? picked.join("\n\n---\n\n") : DOCTRINE_ALL;
}
