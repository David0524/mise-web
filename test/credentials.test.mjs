import test from "node:test";
import assert from "node:assert/strict";
import { passwordProblems, passwordError, checkEmail, PASSWORD_RULES } from "@/lib/credentials";

test("a strong password has no problems", () => {
  assert.deepEqual(passwordProblems("Kitchen-qa-2026", "cook@example.com"), []);
  assert.equal(passwordError("Kitchen-qa-2026", "cook@example.com"), "");
});

test("each missing rule is listed by its checklist label", () => {
  const labels = Object.fromEntries(PASSWORD_RULES.map(([id, label]) => [id, label]));
  assert.ok(passwordProblems("ab1").includes(labels.length));
  assert.ok(passwordProblems("12345679").includes(labels.letter));
  assert.ok(passwordProblems("abcdefghij").includes(labels.number));
  // Any script's letters count, not just A-Z.
  assert.ok(!passwordProblems("пароль2026x").includes(labels.letter));
});

test("non-strings are treated as empty, never thrown on", () => {
  for (const bad of [undefined, null, 12345678, ["password1"], { pw: 1 }]) {
    assert.ok(passwordProblems(bad).length > 0);
    assert.match(passwordError(bad), /^Your password needs /);
  }
});

test("the 72-byte bcrypt limit counts bytes, not characters", () => {
  assert.deepEqual(passwordProblems("a1" + "x".repeat(70)), []);
  assert.ok(passwordProblems("a1" + "x".repeat(71)).some((p) => /72/.test(p)));
  // 18 four-byte emoji are 72 bytes; with a letter and a number it's over.
  assert.ok(passwordProblems("a1" + "🍳".repeat(18)).some((p) => /72/.test(p)));
});

test("common passwords are refused, case-insensitively", () => {
  assert.ok(passwordProblems("Password123").includes("Not a very common password"));
  assert.equal(passwordError("PASSWORD1"), "That password is too common. Pick another.");
});

test("the email's name can't be inside the password", () => {
  assert.ok(passwordProblems("Marguerite2026", "marguerite@example.com").includes("Not your email"));
  assert.equal(passwordError("xxMARGUERITE99", "marguerite@example.com"), "Your password can't contain your email.");
  // Very short local parts would match too much, so they're ignored.
  assert.deepEqual(passwordProblems("Kitchen-abc-2026", "abc@example.com"), []);
});

test("missing rules are reported together in one sentence", () => {
  assert.equal(passwordError(""), "Your password needs at least 8 characters, a letter, a number.");
});

test("checkEmail accepts and normalises a real address", () => {
  assert.deepEqual(checkEmail("  Cook@Example.COM "), { ok: true, email: "cook@example.com" });
});

test("checkEmail rejects empty and malformed addresses", () => {
  assert.equal(checkEmail("").error, "Enter your email.");
  assert.equal(checkEmail(null).error, "Enter your email.");
  for (const bad of ["cook", "cook@", "cook@example", "cook@example.c", "co ok@example.com", "cook@@example.com",
    "cook..x@example.com", "cook@.example.com", ".cook@example.com", "a@b.com.", "x".repeat(250) + "@example.com"]) {
    assert.equal(checkEmail(bad).ok, false, bad);
  }
});

test("checkEmail suggests the domain people meant", () => {
  assert.deepEqual(checkEmail("cook@gmial.com"), { ok: false, error: "Did you mean cook@gmail.com?", suggestion: "cook@gmail.com" });
  assert.equal(checkEmail("cook@hotmail.co").suggestion, "cook@hotmail.com");
  assert.equal(checkEmail("cook@mydomain.con").suggestion, "cook@mydomain.com");
  assert.equal(checkEmail("cook@gmail.com").ok, true);
});
