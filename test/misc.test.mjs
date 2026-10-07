import test from "node:test";
import assert from "node:assert/strict";
import { safeNext, devFake } from "@/lib/identity";
import { normalizePhone } from "@/lib/messaging";
import { readCredentials } from "@/lib/auth";

test("safeNext allows same-site paths only", () => {
  assert.equal(safeNext("/app"), "/app");
  assert.equal(safeNext("/pricing?plan=yearly"), "/pricing?plan=yearly");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "app", "", null, 5, ["/app"]]) assert.equal(safeNext(bad), "", String(bad));
  assert.equal(safeNext("/" + "a".repeat(500)).length, 200);
});

test("devFake refuses to run on an https APP_URL", () => {
  const before = { flag: process.env.DEV_FAKE_SMS, app: process.env.APP_URL };
  try {
    process.env.DEV_FAKE_SMS = "1";
    process.env.APP_URL = "http://localhost:3000";
    assert.equal(devFake("DEV_FAKE_SMS"), true);
    process.env.APP_URL = "https://misekitchen.app";
    assert.equal(devFake("DEV_FAKE_SMS"), false);
    process.env.APP_URL = "HTTPS://misekitchen.app";
    assert.equal(devFake("DEV_FAKE_SMS"), false);
    process.env.APP_URL = "http://localhost:3000";
    process.env.DEV_FAKE_SMS = "true";
    assert.equal(devFake("DEV_FAKE_SMS"), false);
  } finally {
    for (const [k, v] of [["DEV_FAKE_SMS", before.flag], ["APP_URL", before.app]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test("normalizePhone gives E.164 or null", () => {
  assert.equal(normalizePhone("(415) 555-0123"), "+14155550123");
  assert.equal(normalizePhone("1 415 555 0123"), "+14155550123");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  for (const bad of ["", "555-0123", "+0123456789", "phone", null, 4155550123, "+1234567890123456"]) {
    assert.equal(normalizePhone(bad), null, String(bad));
  }
});

test("readCredentials never throws on the wrong types", () => {
  assert.deepEqual(readCredentials({ email: "  Cook@Example.com ", password: " pw " }), { email: "cook@example.com", password: " pw " });
  for (const body of [null, undefined, {}, { email: 5, password: ["x"] }, { email: { a: 1 }, password: 12345678 }]) {
    assert.deepEqual(readCredentials(body), { email: "", password: "" });
  }
});
