import test from "node:test";
import assert from "node:assert/strict";
import { buildDoctrine, DOCTRINE_ALL } from "@/lib/doctrine";
import slices from "@/lib/doctrine.json";

const SEP = "\n\n---\n\n";

test("doctrine.json has the three named slices, none empty", () => {
  for (const name of ["core", "groceries", "flavor"]) {
    assert.equal(typeof slices[name], "string", name);
    assert.ok(slices[name].trim().length > 100, name);
  }
});

test("each call gets exactly the slices it asks for, in order", () => {
  assert.equal(buildDoctrine(["core"]), slices.core);
  assert.equal(buildDoctrine(["core", "groceries"]), slices.core + SEP + slices.groceries);
  assert.equal(buildDoctrine(["core", "flavor"]), slices.core + SEP + slices.flavor);
  assert.equal(buildDoctrine(["flavor", "core"]), slices.flavor + SEP + slices.core);
});

test("the full doctrine is every slice", () => {
  assert.equal(DOCTRINE_ALL, [slices.core, slices.groceries, slices.flavor].join(SEP));
  assert.equal(buildDoctrine(["core", "groceries", "flavor"]), DOCTRINE_ALL);
});

test("no list, an empty list or only unknown names falls back to everything", () => {
  for (const names of [undefined, null, [], "core", ["nope"], ["nope", "also-nope"]]) {
    assert.equal(buildDoctrine(names), DOCTRINE_ALL, JSON.stringify(names));
  }
});

test("unknown names next to real ones are skipped", () => {
  assert.equal(buildDoctrine(["core", "nope"]), slices.core);
});
