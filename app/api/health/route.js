import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { schemaStatus, ensureSchema } from "@/lib/schema";
import { providers } from "@/lib/providers";

export const dynamic = "force-dynamic";

/* Open /api/health on a deployment to see what's working. No secrets: only
   whether things are set and whether the database answers. */
export async function GET() {
  const out = { ok: true, checks: {} };
  const fail = (k, e) => { out.ok = false; out.checks[k] = { ok: false, error: `${e?.code || ""} ${e?.message || e}`.trim().slice(0, 200) }; };
  try { await query("select 1"); out.checks.database = { ok: true }; } catch (e) { fail("database", e); }
  if (out.checks.database?.ok) {
    try {
      await ensureSchema().catch(() => {});
      const s = await schemaStatus();
      out.checks.schema = s.ok ? { ok: true } : (out.ok = false, { ok: false, missing: s.missing });
    } catch (e) { fail("schema", e); }
  }
  out.checks.session_secret = { ok: !!process.env.SESSION_SECRET };
  if (!process.env.SESSION_SECRET) out.ok = false;
  out.checks.app_url = { ok: /^https?:\/\//.test(process.env.APP_URL || ""), value: process.env.APP_URL || null };
  out.checks.ai = { ok: !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS) };
  out.checks.stripe = { ok: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) };
  out.sign_in = providers();
  return NextResponse.json(out, { status: out.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
