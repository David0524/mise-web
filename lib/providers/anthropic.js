/* The original Anthropic implementation, unchanged in behavior — just pulled
   out into its own module so the route handler can pick a provider instead
   of being locked to one. Every provider module exports the same shape:
   callModel(messages, systemText, { tier, maxTokens }) -> Promise<string>. */

const MODELS = { main: "claude-sonnet-4-6", fast: "claude-haiku-4-5-20251001" };

export async function callModel(messages, systemText, { tier = "main", maxTokens = 1000, userKey } = {}) {
  // Accepts either a string (legacy) or an array of blocks, so the other
  // providers keep working unchanged while this one gets real cache control.
  const blocks = Array.isArray(systemText) ? systemText : [systemText];
  /* userKey is the bring-your-own-key path. Without this parameter the
     provider silently fell back to the server key — meaning a user who set
     their own key would still have been billing US, which is the exact
     opposite of what they asked for and would have been invisible. */
  const model = MODELS[tier] || MODELS.main;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": userKey || process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      /* Cache breakpoint on the FIRST block only. The doctrine is stable, so it
         caches and stays cached; the profile block after it is small and may
         differ per request, and marking it too would just create a second entry
         that misses as often as it hits. */
      system: blocks.map((text, i) => (
        i === 0 ? { type: "text", text, cache_control: { type: "ephemeral" } }
                : { type: "text", text }
      )),
      messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Anthropic API error", res.status, detail.slice(0, 500));
    const err = new Error("upstream");
    if (userKey) {
      // Only meaningful on the BYOK path — these are the person's own account
      // problems, and only they can fix them.
      if (res.status === 401) err.userFacing = "That Anthropic key was rejected. Check it in My Kitchen.";
      else if (res.status === 429) err.userFacing = "Your Anthropic account hit its rate limit or is out of credit.";
    }
    throw err;
  }

  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
