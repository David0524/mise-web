/* Client side of the usage events (lib/events.js): fire and forget, never
   awaited, never shown. Nothing is stored on the device; the server attaches
   the account if there is one. */
export function track(name, props) {
  try {
    fetch("/api/events", {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, props: props || {} }),
    }).catch(() => {});
  } catch (_) { /* never matters */ }
}

/* A copy of each recipe Mise writes ("new") or rewrites on request
   ("changed"), for the owner's stats page. Weeks get replaced, so this is the
   only complete record of what was generated. */
export function trackRecipe(recipe, kind) {
  try {
    if (!recipe || typeof recipe !== "object") return;
    fetch("/api/events", {
      method: "POST", keepalive: JSON.stringify(recipe).length < 60000,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "recipe_generated", props: { kind }, recipe }),
    }).catch(() => {});
  } catch (_) { /* never matters */ }
}
