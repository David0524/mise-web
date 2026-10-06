import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";

/* The JSON blobs the client persists, one row per user per key. Kept as blobs
   rather than normalised into real columns — nothing here needs querying by
   field yet, and matching the old window.storage shape means the client's
   persistence code barely changed during the port.

   mise:recipes-v1 and mise:week-v1 are newer: the recipe book was being
   written by the client long before the server accepted it (every save came
   back 400 and was swallowed), and the week in progress lived only in React
   state, so a refresh threw it away. */
const TABLES = {
  "mise:profile-v3": "profiles",
  "mise:history-v1": "histories",
  "mise:recipes-v1": "recipe_books",
  "mise:week-v1": "current_weeks",
};

/* Own properties only. `TABLES[key]` on a plain object also answers for
   "constructor", "toString", "__proto__"… which then landed in the SQL as a
   table name and crashed the query. */
const tableFor = (key) => (typeof key === "string" && Object.hasOwn(TABLES, key) ? TABLES[key] : null);

/* Under Vercel's 4.5MB request-body ceiling with room for the envelope. Past
   this the platform rejects the request before this code runs, so failing here
   first at least returns an answer the client can act on. */
const MAX_VALUE_CHARS = 4_000_000;

/* Same limits the client applies in archiveWeek — enforced here too, because
   merging can bring back weeks a client had already trimmed. */
const MAX_WEEKS = 40;
const PHOTO_WEEKS = 6;
const RECIPE_BOOK_MAX = 200;
const FAVORITES_MAX = 200;
const FAVORITE_PHOTOS = 12;

const stamp = (w) => String(w?.updatedAt || w?.startedAt || "");

/* Photos are data URLs (~100KB each) and are the only thing that makes these
   blobs big. Rather than trusting a count of weeks or ratings to stay small,
   drop photos oldest-first until the blob fits its budget — the history
   budget leaves room under MAX_VALUE_CHARS; the profile one is smaller because
   the profile is re-sent on every settings change. `list` is newest-LAST. */
function fitPhotos(list, budget, photosOf, strip) {
  let out = list;
  for (let i = 0; i < out.length && JSON.stringify(out).length > budget; i++) {
    if (photosOf(out[i])) out = out.map((x, n) => (n === i ? strip(x) : x));
  }
  return out;
}
/* History's version (same as the client's): drops one DISH's photos at a time, oldest week first, so a
   single photo-heavy week loses its oldest pictures rather than all of them.
   `weeks` is newest-FIRST, as stored. */
function fitHistoryPhotos(weeks, budget) {
  let out = weeks;
  const size = () => JSON.stringify(out).length;
  if (size() <= budget) return out;
  for (let wi = out.length - 1; wi >= 0; wi--) {
    const dishes = out[wi].dishes || [];
    for (let di = 0; di < dishes.length; di++) {
      if (!out[wi].dishes[di]?.photos?.length) continue;
      out = out.map((w, n) => (n !== wi ? w : {
        ...w, dishes: w.dishes.map((d, m) => (m === di ? (({ photos, ...rest }) => rest)(d) : d)),
      }));
      if (size() <= budget) return out;
    }
  }
  return out;
}
const HISTORY_BUDGET = 3_000_000;
const PROFILE_BUDGET = 1_000_000;

/* History is written whole by every open tab and device, from whatever copy
   that tab loaded. Last-write-wins meant a second tab silently deleted every
   week the first one had archived since it loaded. Merge per week instead: a
   week either side knows about survives, and where both have it the more
   recently updated copy wins (ties go to the incoming write, which is the
   person's latest action). */
function mergeHistory(stored, incoming) {
  const byId = new Map();
  for (const w of Array.isArray(stored) ? stored : []) if (w && w.id) byId.set(w.id, w);
  for (const w of Array.isArray(incoming) ? incoming : []) {
    if (!w || !w.id) continue;
    const prev = byId.get(w.id);
    if (!prev || stamp(w) >= stamp(prev)) byId.set(w.id, w);
  }
  const weeks = [...byId.values()]
    .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")))
    .slice(0, MAX_WEEKS)
    .map((w, i) =>
      i < PHOTO_WEEKS ? w : { ...w, dishes: (w.dishes || []).map(({ photos, ...d }) => d) }
    );
  return fitHistoryPhotos(weeks, HISTORY_BUDGET);
}

/* Recipe book: title -> recipe. Union, newer savedAt wins, oldest dropped past the cap. */
function mergeRecipes(stored, incoming) {
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const out = { ...obj(stored) };
  for (const [k, r] of Object.entries(obj(incoming))) {
    if (!out[k] || String(r?.savedAt || "") >= String(out[k]?.savedAt || "")) out[k] = r;
  }
  const keys = Object.keys(out);
  if (keys.length > RECIPE_BOOK_MAX) {
    keys
      .sort((a, b) => String(out[a]?.savedAt || "").localeCompare(String(out[b]?.savedAt || "")))
      .slice(0, keys.length - RECIPE_BOOK_MAX)
      .forEach((k) => delete out[k]);
  }
  return out;
}

/* Profile: last write wins for the settings themselves, but favorites (ratings)
   are only ever appended, so union them by id — otherwise a stale tab erases a
   rating made in another. Photos are kept on the most recent ones only: every
   favorite carried its photos forever, and the whole blob is re-sent on every
   settings tweak. */
function mergeProfile(stored, incoming) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return incoming;
  const mine = Array.isArray(incoming.favorites) ? incoming.favorites : [];
  const theirs = Array.isArray(stored?.favorites) ? stored.favorites : [];
  const seen = new Set(mine.map((f) => f?.id).filter(Boolean));
  const favorites = [...theirs.filter((f) => f?.id && !seen.has(f.id)), ...mine]
    .sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")))
    .slice(-FAVORITES_MAX);
  const firstWithPhotos = Math.max(0, favorites.length - FAVORITE_PHOTOS);
  const trimmed = favorites.map((f, i) => (i >= firstWithPhotos || !f?.photos ? f : (({ photos, ...rest }) => rest)(f)));
  return {
    ...incoming,
    favorites: fitPhotos(trimmed, PROFILE_BUDGET, (f) => f?.photos?.length, ({ photos, ...rest }) => rest),
  };
}

const MERGE = { histories: mergeHistory, recipe_books: mergeRecipes, profiles: mergeProfile };

/* Every path returns JSON. A throw that escaped used to come back as a 500 with
   an empty body. */
function dbError(e) {
  // The session outlived the account (user row deleted): treat as signed out.
  if (e?.code === "23503") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  // Postgres jsonb can't hold \u0000 or lone surrogates.
  if (e?.code === "22P05" || e?.code === "22P02" || e?.code === "22021") {
    return NextResponse.json({ error: "value contains characters that can't be stored" }, { status: 400 });
  }
  console.error("storage failure:", e?.code || "", e?.message || e);
  // The Postgres code goes back so a person can quote it (no data or secrets in it).
  return NextResponse.json({ error: "storage_failed", code: e?.code || null }, { status: 500 });
}

export async function GET(req) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const table = tableFor(new URL(req.url).searchParams.get("key"));
  if (!table) return NextResponse.json({ error: "unknown key" }, { status: 400 });

  try {
    const { rows } = await query(`select data from ${table} where user_id = $1`, [userId]);
    return NextResponse.json({ value: rows[0] ? JSON.stringify(rows[0].data) : null });
  } catch (e) {
    return dbError(e);
  }
}

export async function POST(req) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { key, value } = body || {};
  const table = tableFor(key);
  if (!table) return NextResponse.json({ error: "unknown key" }, { status: 400 });
  if (typeof value !== "string") return NextResponse.json({ error: "value must be JSON" }, { status: 400 });
  if (value.length > MAX_VALUE_CHARS) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (_) {
    return NextResponse.json({ error: "value must be JSON" }, { status: 400 });
  }
  if (parsed === null || typeof parsed !== "object") {
    return NextResponse.json({ error: "value must be a JSON object or array" }, { status: 400 });
  }

  const merge = MERGE[table];
  if (!merge) {
    try {
      await query(
        `insert into ${table} (user_id, data, updated_at) values ($1, $2, now())
         on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
        [userId, JSON.stringify(parsed)]
      );
      return NextResponse.json({ ok: true });
    } catch (e) {
      return dbError(e);
    }
  }

  /* Read-merge-write under a row lock, so two tabs saving at the same instant
     can't both merge against the same stale copy. The insert-if-missing first
     guarantees there is a row to lock. */
  try {
    const out = await withTransaction(async (client) => {
      await client.query(
        `insert into ${table} (user_id) values ($1) on conflict (user_id) do nothing`,
        [userId]
      );
      const { rows } = await client.query(`select data from ${table} where user_id = $1 for update`, [userId]);
      const merged = JSON.stringify(merge(rows[0]?.data, parsed));
      await client.query(`update ${table} set data = $2, updated_at = now() where user_id = $1`, [userId, merged]);
      return merged;
    });
    // The merged value goes back so the client can adopt anything another tab added.
    return NextResponse.json({ ok: true, value: out });
  } catch (e) {
    return dbError(e);
  }
}
