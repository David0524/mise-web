import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

/* First-party usage events for the private stats page (/admin). Kept in our
   own database, never sent anywhere else. Signed-in events carry the account
   id; onboarding steps before sign-up carry nothing that identifies anyone.

   Only names on these lists are stored, and props are trimmed to a few short
   values, so the endpoint can't be used to write arbitrary data. */
export const GUEST_EVENTS = new Set(["onboard", "paywall_view"]);
export const USER_EVENTS = new Set([
  "onboard", "paywall_view", "app_open", "view",
  "week_planned", "dish_swapped", "feedback_sent",
  "list_built", "list_edited",
  "recipe_opened", "recipe_change_asked", "recipe_changed",
  "ask_mise", "timer_started", "printed", "voice_used",
  "leftovers", "new_week", "dish_rated", "cook_again",
  // Logged by the server itself.
  "signup", "code_redeemed", "checkout_started",
]);

function cleanProps(props) {
  const out = {};
  if (!props || typeof props !== "object") return out;
  for (const [k, v] of Object.entries(props).slice(0, 8)) {
    if (!/^[a-z_]{1,24}$/i.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 60);
  }
  return out;
}

/* Never throws: a stats write must never break the thing being counted. */
export async function logEvent(userId, name, props) {
  try {
    if (!(userId ? USER_EVENTS : GUEST_EVENTS).has(name)) return false;
    await ensureSchema();
    // "app_open" at most once an hour per person, so a busy evening isn't 40 opens.
    if (name === "app_open" && userId) {
      const { rows } = await query(
        `select 1 from events where user_id = $1 and name = 'app_open' and created_at > now() - interval '1 hour' limit 1`, [userId]);
      if (rows.length) return true;
    }
    await query(`insert into events (user_id, name, props) values ($1, $2, $3)`, [userId || null, name, cleanProps(props)]);
    if (Math.random() < 0.002) query(`delete from events where created_at < now() - interval '400 days'`).catch(() => {});
    return true;
  } catch (e) {
    console.error("event log failed:", e?.code || "", e?.message || e);
    return false;
  }
}
