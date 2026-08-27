import slices from "./doctrine.json";

// Same source as the artifact: weekly-cooking-collaborator/SKILL.md, compiled
// by build_doctrine.py. Regenerate with:
//   python3 build_doctrine.py <path-to-artifact.jsx> lib/doctrine.json
// One uniform block, not per-call slices — this is what makes it cacheable.
export const DOCTRINE_ALL = [slices.core, slices.groceries, slices.flavor]
  .filter(Boolean)
  .join("\n\n---\n\n");
