import { query } from "@/lib/db";

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

let ready = null;
export function ensureSchema() {
  if (!ready) {
    ready = (async () => { for (const s of STATEMENTS) await query(s); })()
      .catch((e) => { ready = null; throw e; });
  }
  return ready;
}
