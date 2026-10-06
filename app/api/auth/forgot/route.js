import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loginBlocked, recordLoginFailure, EMAIL_RE } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";
import { randomToken, sha256b64url, appUrl } from "@/lib/identity";
import { sendEmail, emailConfigured } from "@/lib/messaging";

/* Emails a one-hour, single-use reset link. Always answers the same way
   whether or not the email has an account, so the form can't be used to find
   out who's signed up. Only a hash of the token is stored. */
const SAME = { ok: true, message: "If there's an account for that email, a reset link is on its way. It works for one hour." };

export async function POST(req) {
  try {
    if (!emailConfigured()) {
      return NextResponse.json({ error: "Password reset email isn't set up yet. Contact support and we'll help." }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: "Enter the email you signed up with." }, { status: 400 });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const keys = [`reset:${email}`, ...(ip ? [`ip:reset:${ip}`] : [])];
    if (loginBlocked(keys)) return NextResponse.json(SAME);
    recordLoginFailure(keys);

    await ensureSchema();
    const { rows } = await query(`select id from users where email = $1`, [email]);
    if (!rows[0]) return NextResponse.json(SAME);

    const token = randomToken(32);
    await query(`delete from password_resets where user_id = $1`, [rows[0].id]);
    await query(
      `insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 hour')`,
      [await sha256b64url(token), rows[0].id]
    );
    const link = `${appUrl()}/reset?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Reset your Mise password",
      text: `Someone (hopefully you) asked to reset the password for your Mise account.\n\nChoose a new password here: ${link}\n\nThe link works once, for one hour. If you didn't ask for this, ignore this email and your password stays the same.`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#221A15;max-width:480px">
        <p>Someone (hopefully you) asked to reset the password for your Mise account.</p>
        <p><a href="${link}" style="display:inline-block;background:#B44722;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Choose a new password</a></p>
        <p style="color:#51453D;font-size:14px">The link works once, for one hour. If you didn't ask for this, ignore this email and your password stays the same.</p></div>`,
    });
    return NextResponse.json(SAME);
  } catch (e) {
    console.error("forgot failed:", e?.code || "", e?.message || e);
    return NextResponse.json({ error: "Couldn't send the email just now. Try again in a moment." }, { status: 502 });
  }
}
