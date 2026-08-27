import { Pool } from "pg";

// One pool for the whole server process. Next.js can reload this module in
// dev, so stash it on globalThis to avoid opening a fresh pool on every hot
// reload and exhausting the database's connection limit.
const g = globalThis;

export const pool =
  g.__misePool ||
  (g.__misePool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 5,
  }));

export function query(text, params) {
  return pool.query(text, params);
}
