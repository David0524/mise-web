import { query } from "@/lib/db";

/* Consent records on the users row: when someone confirmed their age and
   accepted the Terms, and which version of the policies they saw. Added with
   "if not exists" so a database created from an older schema.sql picks the
   columns up on the first signup instead of failing it. Runs once per server. */
let ready = null;
export function ensureConsentColumns() {
  if (!ready) {
    ready = query(`alter table users
      add column if not exists age_confirmed_at  timestamptz,
      add column if not exists terms_accepted_at timestamptz,
      add column if not exists policy_version    text`).catch((e) => { ready = null; throw e; });
  }
  return ready;
}
