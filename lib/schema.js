import { query, pool } from "@/lib/db";

/* Columns and tables added after launch. Every statement is idempotent, so a
   database created from an older prisma/schema.sql picks them up on the first
   auth request instead of failing it. Runs once per server process. Mirrors
   the same statements at the end of prisma/schema.sql. */
const STATEMENTS = [
  // Consent records.
  `alter table users add column if not exists age_confirmed_at  timestamptz`,
  `alter table users add column if not exists terms_accepted_at timestamptz`,
  `alter table users add column if not exists policy_version    text`,
  // Sign in with Google / Apple / phone: those accounts may have no email or
  // no password.
  `alter table users alter column email drop not null`,
  `alter table users alter column password_hash drop not null`,
  `alter table users add column if not exists phone      text`,
  `alter table users add column if not exists google_sub text`,
  `alter table users add column if not exists apple_sub  text`,
  `create unique index if not exists users_phone_key      on users(phone)      where phone is not null`,
  `create unique index if not exists users_google_sub_key on users(google_sub) where google_sub is not null`,
  `create unique index if not exists users_apple_sub_key  on users(apple_sub)  where apple_sub is not null`,
  // Sessions issued before this are dead (set on password reset).
  `alter table users add column if not exists tokens_valid_after timestamptz`,
  // An access code (e.g. VIP26) grants the app without a subscription.
  `alter table subscriptions add column if not exists access_code text`,
  `alter table subscriptions add column if not exists access_code_at timestamptz`,
  // Whether this account has already had the $1 first month.
  `alter table subscriptions add column if not exists intro_used boolean not null default false`,
  // Forgot password: only a hash of the emailed token is stored.
  `create table if not exists password_resets (
     token_hash text primary key,
     user_id    uuid not null references users(id) on delete cascade,
     expires_at timestamptz not null,
     used_at    timestamptz
   )`,
  `create index if not exists idx_password_resets_user on password_resets(user_id)`,
];

/* What a migrated database has. Checked with one read-only query, so a
   database that's already up to date never takes a lock: running ALTER TABLE
   on every cold start locked the users table each time. */
const EXPECT = {
  users: ["age_confirmed_at", "terms_accepted_at", "policy_version", "phone", "google_sub", "apple_sub", "tokens_valid_after"],
  subscriptions: ["access_code", "access_code_at", "intro_used"],
  password_resets: ["token_hash"],
};

export async function schemaStatus() {
  const { rows } = await query(
    `select table_name, column_name from information_schema.columns
      where table_schema = current_schema() and table_name = any($1)`,
    [Object.keys(EXPECT)]
  );
  const have = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  const missing = [];
  for (const [t, cols] of Object.entries(EXPECT)) for (const c of cols) if (!have.has(`${t}.${c}`)) missing.push(`${t}.${c}`);
  return { ok: missing.length === 0, missing };
}

/* Serverless runs many copies of this at once on a fresh deploy. Without
   coordination they raced each other ("duplicate key ... pg_class") and most
   failed. Now: one transaction holding an advisory lock, so they queue and
   the later ones find nothing to do; a short lock_timeout so a busy table
   makes a migration give up and retry rather than stall live requests. */
async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    await client.query("select pg_advisory_xact_lock(724501)");
    for (const sql of STATEMENTS) await client.query(sql);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

let ready = null;
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      if ((await schemaStatus()).ok) return;
      try { await migrate(); }
      catch (e) {
        // Lost a race or timed out on a lock: the other copy has probably
        // finished. Look again before giving up.
        if ((await schemaStatus()).ok) return;
        console.error("schema migration failed:", e?.code || "", e?.message || e);
        throw e;
      }
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
