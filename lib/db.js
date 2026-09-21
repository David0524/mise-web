import { Pool } from "pg";

// One pool for the whole server process. Next.js can reload this module in
// dev, so stash it on globalThis to avoid opening a fresh pool on every hot
// reload and exhausting the database's connection limit.
const g = globalThis;

/* Why this is more than `new Pool({ connectionString })`.
 *
 * pg does NOT complain about a connection string it can't understand — it
 * quietly falls back to its defaults and dials localhost:5432, which on a
 * serverless function surfaces as `connect ECONNREFUSED 127.0.0.1:5432` from
 * deep inside pg-pool. That reads like a database outage. It is almost always
 * a malformed environment variable, and the shapes that cause it are all
 * ordinary copy-paste artifacts. Checked against pg's own parser:
 *
 *   postgres://u:p@host/db        -> host=host          correct
 *   "postgres://u:p@host/db"      -> host=base          wrapped in quotes
 *   ' postgres://u:p@host/db'     -> host=base          leading space
 *   psql postgres://u:p@host/db   -> host=base          copied with the command
 *   DATABASE_URL=postgres://...   -> host=base          copied with the key
 *   host:5432/db                  -> host=(none)        no scheme -> LOCALHOST
 *
 * So: repair what can be repaired, reject what can't, and say which. */
/* Accepted variable names, in order of preference.
 *
 * DATABASE_URL is what this app documents, but almost nobody types a
 * connection string by hand any more — they attach a Postgres integration and
 * it injects its OWN name. Vercel Postgres, Neon and Supabase all inject
 * POSTGRES_URL and never create DATABASE_URL, so an app that reads only
 * DATABASE_URL reports "not set" while a perfectly good database sits
 * attached to the project. Reading the common aliases costs nothing and
 * removes an entire class of "it's configured, why doesn't it work".
 *
 * The pooled URL comes first: these run in serverless functions, where a
 * direct connection per invocation exhausts the connection limit. */
const URL_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL",
];

function readConnectionString() {
  const found = URL_VARS.find((k) => process.env[k] && process.env[k].trim());
  if (!found) {
    // Name every candidate that IS present, so the log says what to do next.
    const present = Object.keys(process.env)
      .filter((k) => /POSTGRES|DATABASE|NEON|SUPABASE/i.test(k))
      .sort();
    return {
      error: "no database connection string in the environment",
      hint: present.length
        ? `Database-ish variables that ARE set: ${present.join(", ")}. ` +
          `If one of those holds the connection string, either rename it to ` +
          `DATABASE_URL or add its name to URL_VARS in lib/db.js.`
        : "No POSTGRES*/DATABASE*/NEON* variable is set at all on this deployment.",
    };
  }
  let v = process.env[found];

  const before = v;
  v = v.trim();
  v = v.replace(/^DATABASE_URL\s*=\s*/i, "");     // pasted with the key name
  v = v.replace(/^psql\s+/i, "");                  // pasted with the command
  v = v.replace(/^["'](.*)["']$/s, "$1").trim();   // wrapped in quotes

  if (!/^postgres(ql)?:\/\//i.test(v)) {
    return { error: "DATABASE_URL has no postgres:// scheme — pg ignores it and dials localhost" };
  }
  return { value: v, from: found, repaired: v !== before.trim() || before !== before.trim() };
}

const conn = readConnectionString();

if (conn.error) {
  console.error(
    `DATABASE: ${conn.error}. Every database call will fail.\n` +
    (conn.hint ? conn.hint + "\n" : "") +
    "On Vercel: Settings > Environment Variables. The value must be the whole " +
    "connection string starting postgres:// — no surrounding quotes, no psql " +
    "prefix, no key name. Tick Production, then REDEPLOY; variables are read " +
    "at build time, so an existing deployment will not pick up a change."
  );
} else {
  /* Log WHERE it is pointing, without the credentials. If this line says
     localhost, the string is wrong however right it looks in the dashboard. */
  try {
    const u = new URL(conn.value);
    console.log(`DATABASE: ${u.hostname}:${u.port || 5432}${u.pathname}` +
      `  [from ${conn.from}]` +
      (conn.repaired ? "  (cleaned up stray quotes/whitespace)" : ""));
  } catch (_) {
    console.error("DATABASE: DATABASE_URL is not a parseable URL");
  }
}

export const pool =
  g.__misePool ||
  (g.__misePool = new Pool({
    connectionString: conn.value,
    ssl: conn.value?.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 5,
  }));

export function query(text, params) {
  if (conn.error) {
    // Thrown rather than attempted, so the route's own error handling runs and
    // the caller gets a real response instead of a connection timeout.
    const e = new Error(conn.error);
    e.code = "NO_DATABASE_URL";
    throw e;
  }
  return pool.query(text, params);
}
