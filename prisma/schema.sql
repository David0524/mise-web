-- Mise database schema. Plain SQL on purpose: four tables doesn't need an ORM,
-- and it means "does this build" never depends on downloading a native binary
-- from somewhere your host might not reach either.
--
-- Run this once against a fresh Postgres database:
--   psql "$DATABASE_URL" -f prisma/schema.sql
-- Any managed Postgres works — Neon, Supabase, Vercel Postgres, Railway, RDS.

create extension if not exists pgcrypto;

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- One row per user. status drives the paywall gate in every /api route.
-- 'trialing' and 'active' both count as "let them in"; everything else doesn't.
create table if not exists subscriptions (
  user_id                 uuid primary key references users(id) on delete cascade,
  status                  text not null default 'none',   -- none | trialing | active | past_due | canceled
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  updated_at              timestamptz not null default now()
);

-- Replaces window.storage's profile key. One JSON blob per user, same shape
-- the artifact already saves — the client code barely has to change.
create table if not exists profiles (
  user_id     uuid primary key references users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Replaces window.storage's history key. Same shape as before: an array of
-- week snapshots, stored as one JSON blob per user for simplicity at this scale.
create table if not exists histories (
  user_id     uuid primary key references users(id) on delete cascade,
  data        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists idx_subscriptions_stripe_customer on subscriptions(stripe_customer_id);
create index if not exists idx_subscriptions_stripe_sub on subscriptions(stripe_subscription_id);

-- ---------------------------------------------------------------------------
-- Additions. Everything below is safe to re-run against an existing database:
--   psql "$DATABASE_URL" -f prisma/schema.sql
-- ---------------------------------------------------------------------------

-- The recipe book (client key mise:recipes-v1). The client has written this key
-- since the recipe book shipped, but the server never had a table for it, so
-- every save was rejected with 400 and swallowed.
create table if not exists recipe_books (
  user_id     uuid primary key references users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- The week in progress (client key mise:week-v1): picks, day plan, shopping
-- list with its ticks, recipes. Previously React state only, so a refresh, an
-- expired session or the Back button threw the whole week away.
create table if not exists current_weeks (
  user_id     uuid primary key references users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Stripe does not deliver events in order. The webhook only applies an event
-- whose `created` is at least as new as the last one it applied.
alter table subscriptions add column if not exists stripe_event_created bigint;

-- Logout revocation. A JWT is valid until it expires; logging out used to only
-- delete the cookie, so a copied token kept working for 30 days.
create table if not exists revoked_sessions (
  jti         text primary key,
  expires_at  timestamptz not null
);
create index if not exists idx_revoked_sessions_expires on revoked_sessions(expires_at);

-- ---------------------------------------------------------------------------
-- Added later. lib/schema.js applies the same statements automatically on the
-- first auth request, so an existing database doesn't need this re-run.

-- Consent records: when the person confirmed they're 18+ and accepted the
-- Terms, and the policy version they saw (lib/business.js POLICY_VERSION).
alter table users add column if not exists age_confirmed_at  timestamptz;
alter table users add column if not exists terms_accepted_at timestamptz;
alter table users add column if not exists policy_version    text;

-- Sign in with Google / Apple / phone.
alter table users alter column email drop not null;
alter table users alter column password_hash drop not null;
alter table users add column if not exists phone      text;
alter table users add column if not exists google_sub text;
alter table users add column if not exists apple_sub  text;
create unique index if not exists users_phone_key      on users(phone)      where phone is not null;
create unique index if not exists users_google_sub_key on users(google_sub) where google_sub is not null;
create unique index if not exists users_apple_sub_key  on users(apple_sub)  where apple_sub is not null;
-- Sessions issued before this are dead (set on password reset).
alter table users add column if not exists tokens_valid_after timestamptz;

-- Access codes (ACCESS_CODES, default VIP26) and the one-time $1 first month.
alter table subscriptions add column if not exists access_code text;
alter table subscriptions add column if not exists access_code_at timestamptz;
alter table subscriptions add column if not exists intro_used boolean not null default false;

-- Forgot password. Only a SHA-256 of the emailed token is stored.
create table if not exists password_resets (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists idx_password_resets_user on password_resets(user_id);

-- Per-user call counts for the AI and voice limits (lib/limits.js).
create table if not exists api_usage (
  user_id      uuid not null references users(id) on delete cascade,
  bucket       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, bucket, window_start)
);

-- Usage events for the private stats page (lib/events.js). user_id is null for
-- onboarding steps taken before an account exists.
create table if not exists events (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete cascade,
  name       text not null,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_created on events(created_at);
create index if not exists idx_events_user on events(user_id, created_at);
