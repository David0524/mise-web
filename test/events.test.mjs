import test from "node:test";
import assert from "node:assert/strict";
import { cleanProps, logEvent, GUEST_EVENTS, USER_EVENTS } from "@/lib/events";

test("props keep numbers, booleans and short strings only", () => {
  assert.deepEqual(cleanProps({ n: 3, ok: true, step: "setup", bad: NaN, inf: Infinity, obj: { a: 1 }, arr: [1], nul: null, und: undefined }),
    { n: 3, ok: true, step: "setup" });
});

test("strings are cut to 60 characters", () => {
  assert.equal(cleanProps({ s: "x".repeat(500) }).s.length, 60);
});

test("only short snake/letter keys survive", () => {
  assert.deepEqual(cleanProps({ "bad-key": 1, "has space": 1, ["x".repeat(25)]: 1, ["y".repeat(24)]: 2, Fine_Key: 3, "": 4, k2: 5 }),
    { ["y".repeat(24)]: 2, Fine_Key: 3 });
});

test("at most the first 8 props are looked at", () => {
  const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${String.fromCharCode(97 + i)}`, i]));
  assert.equal(Object.keys(cleanProps(many)).length, 8);
});

test("anything that isn't an object gives empty props", () => {
  for (const bad of [null, undefined, "str", 5, true]) assert.deepEqual(cleanProps(bad), {});
});

test("guests may only log onboarding and paywall views", () => {
  assert.deepEqual([...GUEST_EVENTS].sort(), ["onboard", "paywall_view"]);
  for (const name of GUEST_EVENTS) assert.ok(USER_EVENTS.has(name), name);
});

test("names off the allowlist are refused before the database is touched", async () => {
  // The test DATABASE_URL points nowhere: reaching a query would log an error
  // and still return false, so also check nothing tried to connect by timing.
  const t0 = Date.now();
  assert.equal(await logEvent(null, "week_planned", {}), false); // signed-in only
  assert.equal(await logEvent(null, "signup", {}), false);
  assert.equal(await logEvent("00000000-0000-0000-0000-000000000000", "drop_table", {}), false);
  assert.equal(await logEvent(null, "", {}), false);
  assert.ok(Date.now() - t0 < 200);
});
