/* Email and password rules, shared by the sign-up and reset screens and the
   server routes, so the browser and the server can never disagree. No
   imports: safe in both. */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores anything past 72 bytes

/* The passwords that get tried first in any attack. Not exhaustive, just the
   ones a person might genuinely type. */
const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "12345678", "123456789", "1234567890",
  "qwerty123", "qwertyuiop", "iloveyou1", "letmein1", "welcome1", "abc12345", "11111111", "00000000",
  "football1", "baseball1", "monkey123", "dragon123", "sunshine1", "princess1", "trustno1", "admin123",
  "mise1234", "cooking1", "password!", "qwerty12", "1q2w3e4r", "aa123456",
]);

const bytes = (s) => new TextEncoder().encode(s).length;

/* Each rule: [id, label shown as a checklist, test]. */
export const PASSWORD_RULES = [
  ["length", `At least ${PASSWORD_MIN} characters`, (pw) => pw.length >= PASSWORD_MIN],
  ["letter", "A letter", (pw) => /\p{L}/u.test(pw)],
  ["number", "A number", (pw) => /\d/.test(pw)],
];

/* Problems with a password, as short sentences. Empty array = fine. */
export function passwordProblems(pw, email = "") {
  const p = typeof pw === "string" ? pw : "";
  const out = [];
  for (const [, label, test] of PASSWORD_RULES) if (!test(p)) out.push(label);
  if (bytes(p) > PASSWORD_MAX_BYTES) out.push("Shorter than 72 characters (fewer with emoji)");
  if (p && !p.trim()) out.push("Not just spaces");
  if (COMMON.has(p.toLowerCase())) out.push("Not a very common password");
  const local = String(email || "").split("@")[0].toLowerCase();
  if (local.length >= 4 && p.toLowerCase().includes(local)) out.push("Not your email");
  return out;
}

const SENTENCES = {
  "Not a very common password": "That password is too common. Pick another.",
  "Not your email": "Your password can't contain your email.",
  "Not just spaces": "Your password can't be just spaces.",
};

export function passwordError(pw, email) {
  const probs = passwordProblems(pw, email);
  const missing = probs.filter((p) => PASSWORD_RULES.some(([, l]) => l === p));
  if (missing.length) return `Your password needs ${missing.join(", ").toLowerCase()}.`;
  if (!probs.length) return "";
  return SENTENCES[probs[0]] || "Use a shorter password.";
}

/* Typo'd domains people actually type, mapped to what they meant. */
const DOMAIN_FIXES = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gnail.com": "gmail.com", "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.co": "outlook.com",
  "iclod.com": "icloud.com", "icloud.co": "icloud.com", "icoud.com": "icloud.com",
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* { ok, error, suggestion } for an email address. */
export function checkEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Enter your email." };
  if (email.length > 254 || !EMAIL_SHAPE.test(email) || /\.\.|@\.|\.@|^\.|\.$/.test(email)) {
    return { ok: false, error: "That doesn't look like an email address." };
  }
  const domain = email.split("@")[1];
  if (/\.(con|cmo|ocm|coom)$/.test(domain) || DOMAIN_FIXES[domain]) {
    const fixed = DOMAIN_FIXES[domain] || domain.replace(/\.(con|cmo|ocm|coom)$/, ".com");
    return { ok: false, error: `Did you mean ${email.split("@")[0]}@${fixed}?`, suggestion: `${email.split("@")[0]}@${fixed}` };
  }
  return { ok: true, email };
}
