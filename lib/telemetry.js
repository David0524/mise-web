import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

/* Beta observability: notes people send, errors their browser hits, and every
   AI call. All of it stays in our own database for the private stats page
   (/admin). None of these ever throws: recording a problem must never become
   a second problem. */

const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

/* Context is a handful of short labels the app attaches (screen, viewport,
   browser, build); anything else is dropped so the column can't be used to
   store arbitrary data. */
export function cleanContext(ctx) {
  const out = {};
  if (!ctx || typeof ctx !== "object" || Array.isArray(ctx)) return out;
  for (const [k, v] of Object.entries(ctx).slice(0, 12)) {
    if (!/^[a-z_]{1,24}$/i.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 120);
  }
  return out;
}

export async function saveFeedback(userId, message, context) {
  try {
    await ensureSchema();
    await query(`insert into feedback (user_id, message, context) values ($1, $2, $3)`,
      [userId, clip(message, 2000), cleanContext(context)]);
    return true;
  } catch (e) {
    console.error("feedback save failed:", e?.code || "", e?.message || e);
    return false;
  }
}

export async function saveClientError(userId, { message, stack, context } = {}) {
  try {
    const msg = clip(message, 300).trim();
    if (!msg) return false;
    await ensureSchema();
    await query(`insert into client_errors (user_id, message, stack, context) values ($1, $2, $3, $4)`,
      [userId || null, msg, clip(stack, 2000) || null, cleanContext(context)]);
    if (Math.random() < 0.002) query(`delete from client_errors where created_at < now() - interval '90 days'`).catch(() => {});
    return true;
  } catch (e) {
    console.error("client error save failed:", e?.code || "", e?.message || e);
    return false;
  }
}

const int = (v) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Math.round(Number(v)) : null);

export async function saveAiCall(c) {
  try {
    await ensureSchema();
    await query(
      `insert into ai_calls (user_id, tier, slices, model, ok, status, latency_ms, input_tokens, output_tokens)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [c.userId || null, clip(c.tier, 20) || null, clip(c.slices, 200) || null, clip(c.model, 80) || null,
        !!c.ok, int(c.status), int(c.latencyMs), int(c.inputTokens), int(c.outputTokens)]);
    if (Math.random() < 0.002) query(`delete from ai_calls where created_at < now() - interval '180 days'`).catch(() => {});
  } catch (e) {
    console.error("ai call log failed:", e?.code || "", e?.message || e);
  }
}
