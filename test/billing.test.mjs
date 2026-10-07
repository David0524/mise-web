import test from "node:test";
import assert from "node:assert/strict";
import { PLANS, INTRO, accessCodes, isAccessCode } from "@/lib/billing";

/* Runs fn with ACCESS_CODES set (or unset), restoring it afterwards. */
function withCodes(value, fn) {
  const before = process.env.ACCESS_CODES;
  if (value === undefined) delete process.env.ACCESS_CODES; else process.env.ACCESS_CODES = value;
  try { fn(); } finally {
    if (before === undefined) delete process.env.ACCESS_CODES; else process.env.ACCESS_CODES = before;
  }
}

test("VIP26 is the default access code, in any case and with spaces", () => {
  withCodes(undefined, () => {
    assert.deepEqual(accessCodes(), ["VIP26"]);
    assert.equal(isAccessCode("VIP26"), true);
    assert.equal(isAccessCode(" vip26 "), true);
    assert.equal(isAccessCode("VIP2"), false);
  });
});

test("ACCESS_CODES replaces the defaults", () => {
  withCodes(" friends , Family2026,, ", () => {
    assert.deepEqual(accessCodes(), ["FRIENDS", "FAMILY2026"]);
    assert.equal(isAccessCode("friends"), true);
    assert.equal(isAccessCode("family2026"), true);
    assert.equal(isAccessCode("VIP26"), false);
  });
});

test("empty, non-string and oversized codes never match", () => {
  withCodes(undefined, () => {
    for (const bad of ["", "   ", null, undefined, 26, ["VIP26"], { code: "VIP26" }]) assert.equal(isAccessCode(bad), false);
  });
  const long = "A".repeat(65);
  withCodes(long, () => assert.equal(isAccessCode(long), false));
});

test("plan prices agree with their labels", () => {
  assert.equal(PLANS.monthly.amount, 1200);
  assert.equal(PLANS.monthly.price, "$12");
  assert.equal(PLANS.yearly.amount, 12000);
  assert.equal(PLANS.yearly.price, "$120");
  assert.equal(INTRO.amount, 100);
  assert.equal(INTRO.price, "$1");
  for (const [id, plan] of Object.entries(PLANS)) assert.equal(plan.id, id);
});
