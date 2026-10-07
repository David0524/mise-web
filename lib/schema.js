import { query, pool } from "@/lib/db";

/* Columns and tables added after launch. Every statement is idempotent, so a
   database created from an older prisma/schema.sql picks them up on the first
   auth request instead of failing it. Runs once per server process. Mirrors
   the same statements at the end of prisma/schema.sql. */
const STATEMENTS = [
  // The base tables. A database set up from an early copy of schema.sql was
  // missing the ones added later (recipe_books, current_weeks,
  // revoked_sessions), so every save to them failed with 42P01. All
  // idempotent; gen_random_uuid() is built into Postgres 13+.
  `create table if not exists users (
     id            uuid primary key default gen_random_uuid(),
     email         text unique,
     password_hash text,
     created_at    timestamptz not null default now()
   )`,
  `create table if not exists subscriptions (
     user_id                uuid primary key references users(id) on delete cascade,
     status                 text not null default 'none',
     stripe_customer_id     text,
     stripe_subscription_id text,
     current_period_end     timestamptz,
     updated_at             timestamptz not null default now()
   )`,
  `alter table subscriptions add column if not exists stripe_event_created bigint`,
  `create index if not exists idx_subscriptions_stripe_customer on subscriptions(stripe_customer_id)`,
  `create index if not exists idx_subscriptions_stripe_sub on subscriptions(stripe_subscription_id)`,
  ...["profiles", "recipe_books", "current_weeks"].map((t) => `create table if not exists ${t} (
     user_id    uuid primary key references users(id) on delete cascade,
     data       jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   )`),
  `create table if not exists histories (
     user_id    uuid primary key references users(id) on delete cascade,
     data       jsonb not null default '[]'::jsonb,
     updated_at timestamptz not null default now()
   )`,
  `create table if not exists revoked_sessions (
     jti        text primary key,
     expires_at timestamptz not null
   )`,
  `create index if not exists idx_revoked_sessions_expires on revoked_sessions(expires_at)`,
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
  // Per-user call counts for the AI and voice limits (lib/limits.js).
  `create table if not exists api_usage (
     user_id      uuid not null references users(id) on delete cascade,
     bucket       text not null,
     window_start timestamptz not null,
     count        integer not null default 0,
     primary key (user_id, bucket, window_start)
   )`,
  // Usage events for the private stats page (lib/events.js). user_id is null
  // for onboarding steps taken before an account exists: those are counted,
  // not tied to anyone.
  `create table if not exists events (
     id         bigserial primary key,
     user_id    uuid references users(id) on delete cascade,
     name       text not null,
     props      jsonb not null default '{}'::jsonb,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists idx_events_created on events(created_at)`,
  `create index if not exists idx_events_user on events(user_id, created_at)`,
  // Every recipe Mise writes, as written (lib/events.js logRecipe).
  `create table if not exists recipe_log (
     id         bigserial primary key,
     user_id    uuid not null references users(id) on delete cascade,
     kind       text not null default 'new',
     title      text,
     recipe     jsonb not null,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists idx_recipe_log_user on recipe_log(user_id, created_at)`,
  // Notes testers send from the app ("Send feedback"), with the screen they
  // were on and the device, so a report doesn't need a follow-up question.
  `create table if not exists feedback (
     id         bigserial primary key,
     user_id    uuid references users(id) on delete cascade,
     message    text not null,
     context    jsonb not null default '{}'::jsonb,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists idx_feedback_created on feedback(created_at)`,
  // What broke in the browser, reported by the app itself. Never what anyone
  // typed: message, stack and the screen only. user_id is null for guests.
  `create table if not exists client_errors (
     id         bigserial primary key,
     user_id    uuid references users(id) on delete cascade,
     message    text not null,
     stack      text,
     context    jsonb not null default '{}'::jsonb,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists idx_client_errors_created on client_errors(created_at)`,
  // One row per /api/chat call: which tier and doctrine, how long, whether it
  // worked. Token counts when the provider reports them.
  `create table if not exists ai_calls (
     id            bigserial primary key,
     user_id       uuid references users(id) on delete cascade,
     tier          text,
     slices        text,
     model         text,
     ok            boolean not null,
     status        int,
     latency_ms    int,
     input_tokens  int,
     output_tokens int,
     created_at    timestamptz not null default now()
   )`,
  `create index if not exists idx_ai_calls_created on ai_calls(created_at)`,
  `create index if not exists idx_ai_calls_user on ai_calls(user_id, created_at)`,
];

/* What a migrated database has. Checked with one read-only query, so a
   database that's already up to date never takes a lock: running ALTER TABLE
   on every cold start locked the users table each time. */
const EXPECT = {
  profiles: ["data"],
  histories: ["data"],
  recipe_books: ["data"],
  current_weeks: ["data"],
  revoked_sessions: ["jti"],
  users: ["age_confirmed_at", "terms_accepted_at", "policy_version", "phone", "google_sub", "apple_sub", "tokens_valid_after"],
  subscriptions: ["stripe_event_created", "access_code", "access_code_at", "intro_used"],
  password_resets: ["token_hash"],
  api_usage: ["count"],
  events: ["props"],
  recipe_log: ["recipe"],
  feedback: ["context"],
  client_errors: ["stack"],
  ai_calls: ["output_tokens"],
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
