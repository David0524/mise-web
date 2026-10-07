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
