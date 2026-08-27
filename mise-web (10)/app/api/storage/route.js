import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { query } from "@/lib/db";

/* Same two keys the artifact used to write via window.storage: the profile
   blob and the history array. Kept as the same two JSON blobs rather than
   normalised into real columns — nothing here needs querying by field yet,
   and matching the old shape means the client's persistence code barely
   changed during the port. */
const TABLES = { "mise:profile-v3": "profiles", "mise:history-v1": "histories" };

export async function GET(req) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const key = new URL(req.url).searchParams.get("key");
  const table = TABLES[key];
  if (!table) return NextResponse.json({ error: "unknown key" }, { status: 400 });

  const { rows } = await query(`select data from ${table} where user_id = $1`, [userId]);
  return NextResponse.json({ value: rows[0] ? JSON.stringify(rows[0].data) : null });
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
  const table = TABLES[key];
  if (!table) return NextResponse.json({ error: "unknown key" }, { status: 400 });

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (_) {
    return NextResponse.json({ error: "value must be JSON" }, { status: 400 });
  }

  await query(
    `insert into ${table} (user_id, data, updated_at) values ($1, $2, now())
     on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
    [userId, JSON.stringify(parsed)]
  );

  return NextResponse.json({ ok: true });
}
