/* Onboarding happens before there's an account, so anything the person sets
   up is kept in this browser under mise:guest:* until they sign up. After
   sign-in, migrateGuestData() copies it to their account, without ever
   overwriting something the account already has (a returning user who went
   through onboarding again keeps their real kitchen). */

const PREFIX = "mise:guest:";
const KEYS = ["mise:profile-v3", "mise:history-v1", "mise:recipes-v1", "mise:week-v1"];

export function guestGet(key) {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}
export function guestSet(key, value) {
  try { localStorage.setItem(PREFIX + key, value); return true; } catch { return false; }
}

export async function migrateGuestData() {
  for (const key of KEYS) {
    const value = guestGet(key);
    if (!value) continue;
    const r = await fetch(`/api/storage?key=${encodeURIComponent(key)}`);
    if (r.status === 401) return; // not signed in after all; keep it for later
    const existing = r.ok ? (await r.json().catch(() => ({})))?.value : null;
    if (!existing) {
      const w = await fetch("/api/storage", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }),
      });
      if (!w.ok) continue; // leave it to try again next sign-in
    }
    try { localStorage.removeItem(PREFIX + key); } catch {}
  }
}
