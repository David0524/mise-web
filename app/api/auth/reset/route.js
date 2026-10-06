import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { passwordError } from "@/lib/credentials";
import { ensureSchema } from "@/lib/schema";
import { sha256b64url } from "@/lib/identity";

/* Sets a new password from an emailed link, signs out every other session
   (tokens_valid_after), and signs this browser in. */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const pwErr = passwordError(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    if (!token || token.length > 100) return NextResponse.json({ error: "That reset link isn't valid. Ask for a new one." }, { status: 400 });

    await ensureSchema();
    const hash = await sha256b64url(token);
    // Claim the token atomically so it can only ever be used once.
    const { rows } = await query(
      `update password_resets set used_at = now()
        where token_hash = $1 and used_at is null and expires_at > now() returning user_id`,
      [hash]
    );
    if (!rows[0]) return NextResponse.json({ error: "That reset link has expired or was already used. Ask for a new one." }, { status: 400 });
    const userId = rows[0].user_id;
    await query(`update users set password_hash = $1, tokens_valid_after = now() where id = $2`, [await hashPassword(password), userId]);
    await query(`delete from password_resets where user_id = $1`, [userId]);
    // Issued a second later than the cut-off, so this new session survives it.
    await new Promise((r) => setTimeout(r, 1100));
    await createSession(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("reset failed:", e?.code || "", e?.message || e);
    return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
