import { devFake } from "@/lib/identity";

/* SMS codes (Twilio Verify) and transactional email (Resend). Plain fetch
   calls, no SDKs. Both have a local-testing fake (DEV_FAKE_SMS / DEV_LOG_EMAILS)
   that refuses to run on an https APP_URL. */

export const smsConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SID) || devFake("DEV_FAKE_SMS");

const twilio = (path, form) =>
  fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SID}/${path}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(15000),
  });

/* +E.164 or null. A bare 10-digit number is read as US/Canada. */
export function normalizePhone(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[\s().-]/g, "");
  if (/^\d{10}$/.test(s)) s = "+1" + s;
  else if (/^1\d{10}$/.test(s)) s = "+" + s;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}

export async function sendCode(phone) {
  if (devFake("DEV_FAKE_SMS")) { console.warn(`DEV_FAKE_SMS: code for ${phone} is 000000`); return; }
  const r = await twilio("Verifications", { To: phone, Channel: "sms" });
  if (!r.ok) { const e = new Error(`twilio send ${r.status}`); e.status = r.status; throw e; }
}

export async function checkCode(phone, code) {
  if (devFake("DEV_FAKE_SMS")) return code === "000000";
  const r = await twilio("VerificationCheck", { To: phone, Code: code });
  if (r.status === 404) return false; // expired or already used
  if (!r.ok) throw new Error(`twilio check ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return j.status === "approved";
}

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || devFake("DEV_LOG_EMAILS");

export async function sendEmail({ to, subject, text, html }) {
  if (devFake("DEV_LOG_EMAILS")) { console.warn(`DEV_LOG_EMAILS to ${to}: ${subject}\n${text}`); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`resend ${r.status}`);
}
