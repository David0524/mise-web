/* Mistral, as a server provider (AI_PROVIDER=mistral, MISTRAL_API_KEY).

   For testing on Mistral's free "Experiment" tier: every model, about one
   request a second, about a billion tokens a month. That tier REQUIRES
   letting Mistral train on what's sent, so use it with made-up test kitchens
   only, never with real people's data. Mistral calls it evaluation, not
   production.

   The API is OpenAI-compatible chat completions. MISTRAL_MODEL /
   MISTRAL_FAST_MODEL override the models. */

const MODELS = {
  main: process.env.MISTRAL_MODEL || "mistral-large-latest",
  fast: process.env.MISTRAL_FAST_MODEL || "mistral-small-latest",
};
const BUDGET_MS = 50000;

export async function callModel(messages, systemText, { tier = "main", maxTokens = 1000, deadlineAt } = {}) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) {
    console.error("Mistral: MISTRAL_API_KEY is not set");
    throw new Error("upstream");
  }
  const sys = Array.isArray(systemText) ? systemText.join("\n\n---\n\n") : systemText;
  const deadline = Math.min(Date.now() + BUDGET_MS, deadlineAt ?? Infinity);
  const model = MODELS[tier] || MODELS.main;

  /* The free tier allows about one request a second, and the app sends
     bursts (prefetching recipes), so a 429 waits briefly and tries again
     instead of failing the dish. */
  let last;
  for (let tryNum = 0; tryNum < 4; tryNum++) {
    const left = deadline - Date.now();
    if (left < 3000) break;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), left);
    let res;
    try {
      res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: sys }, ...messages],
          max_tokens: maxTokens,
        }),
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      console.error("Mistral: no response in time", e?.name || "");
      throw new Error("upstream");
    }
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const choice = data.choices?.[0];
      if (choice?.finish_reason === "length") console.error("Mistral hit the token ceiling", { usage: data.usage });
      if (tryNum > 0) console.error(`Mistral ok after ${tryNum} rate-limit wait(s)`);
      return (choice?.message?.content || "").trim();
    }
    last = { status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) };
    if (res.status !== 429 && res.status < 500) break;
    const wait = Math.min(Number(res.headers.get("retry-after")) * 1000 || 1200 * (tryNum + 1), 6000);
    await new Promise((r) => setTimeout(r, wait));
  }
  console.error("Mistral API error", last?.status, last?.detail);
  throw new Error("upstream");
}
