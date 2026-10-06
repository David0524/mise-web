import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

/* Per-user ceilings on the paid calls (the AI and the voice). Generous on
   purpose: a heavy planning session is a few dozen AI calls, so these only
   ever stop scripted or runaway use, never someone cooking. Counted in the
   database because serverless instances don't share memory.

   Override with CHAT_LIMIT_10MIN / CHAT_LIMIT_DAY / TTS_LIMIT_10MIN /
   TTS_LIMIT_DAY. Fails open: if the count can't be read, the call goes through. */
const num = (k, d) => (Number(process.env[k]) > 0 ? Number(process.env[k]) : d);
const RULES = {
  chat: [{ span: 10 * 60, max: () => num("CHAT_LIMIT_10MIN", 120) }, { span: 24 * 3600, max: () => num("CHAT_LIMIT_DAY", 600) }],
  tts: [{ span: 10 * 60, max: () => num("TTS_LIMIT_10MIN", 200) }, { span: 24 * 3600, max: () => num("TTS_LIMIT_DAY", 1500) }],
};

export async function overLimit(userId, kind) {
  try {
    await ensureSchema();
    const now = Date.now() / 1000;
    for (const r of RULES[kind] || []) {
      const start = Math.floor(now / r.span) * r.span;
      const { rows } = await query(
        `insert into api_usage (user_id, bucket, window_start, count) values ($1, $2, to_timestamp($3), 1)
         on conflict (user_id, bucket, window_start) do update set count = api_usage.count + 1
         returning count`,
        [userId, `${kind}:${r.span}`, start]
      );
      if (rows[0].count > r.max()) {
        const mins = Math.ceil((start + r.span - now) / 60);
        return {
          retryAfter: mins * 60,
          message: r.span > 3600
            ? "You've used Mise a lot today. The kitchen reopens tomorrow."
            : `That's a lot of requests in a short time. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
        };
      }
    }
    if (Math.random() < 0.01) query(`delete from api_usage where window_start < now() - interval '2 days'`).catch(() => {});
    return null;
  } catch (e) {
    console.error("rate limit check failed (allowing):", e?.code || "", e?.message || e);
    return null;
  }
}
