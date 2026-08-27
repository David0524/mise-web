/* The original Anthropic implementation, unchanged in behavior — just pulled
   out into its own module so the route handler can pick a provider instead
   of being locked to one. Every provider module exports the same shape:
   callModel(messages, systemText, { tier, maxTokens }) -> Promise<string>. */

const MODELS = { main: "claude-sonnet-4-6", fast: "claude-haiku-4-5-20251001" };

export async function callModel(messages, systemText, { tier = "main", maxTokens = 1000 } = {}) {
  const model = MODELS[tier] || MODELS.main;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
      messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Anthropic API error", res.status, detail.slice(0, 500));
    throw new Error("upstream");
  }

  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
