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
