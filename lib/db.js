import { Pool } from "pg";

// One pool for the whole server process. Next.js can reload this module in
// dev, so stash it on globalThis to avoid opening a fresh pool on every hot
// reload and exhausting the database's connection limit.
const g = globalThis;

/* pg falls back to localhost:5432 when given no connection string, so a
   MISSING DATABASE_URL surfaces as `connect ECONNREFUSED 127.0.0.1:5432` from
   somewhere deep in pg-pool — which reads like a database outage rather than
   the configuration mistake it actually is, and sent a real debugging session
   looking in entirely the wrong place. Say what's wrong instead. */
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Every database call will fail. " +
    "On Vercel: Settings > Environment Variables, add DATABASE_URL, " +
    "make sure it is enabled for the Production environment, then REDEPLOY — " +
    "environment variables are read at build time, so an existing deployment " +
    "will not pick up a newly added one."
  );
}

export const pool =
  g.__misePool ||
  (g.__misePool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 5,
  }));

export function query(text, params) {
  if (!process.env.DATABASE_URL) {
    // Thrown rather than attempted, so the route's own error handling runs and
    // the caller gets a real response instead of a connection timeout.
    const e = new Error("DATABASE_URL is not configured on this deployment");
    e.code = "NO_DATABASE_URL";
    throw e;
  }
  return pool.query(text, params);
}
