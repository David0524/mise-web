/* OpenAI, running on a key the USER supplies — not one of ours.

   This is deliberately the "bring your own key" path, not a ChatGPT-subscription
   path. Making someone's ChatGPT *subscription* pay for third-party inference
   requires presenting the app to OpenAI's servers as the Codex CLI, using their
   own first-party client identity so the traffic is treated as first-party.
   That's the mechanism Anthropic prohibited in Feb 2026 (enforced April 2026)
   and Google shut down for Gemini CLI around the same time; OpenAI simply
   hasn't closed it yet. It can be switched off without notice, and when it is,
   every user relying on it breaks at once.

   A user's own API key achieves the same economics — their account pays, we pay
   nothing — with none of that fragility.

   The key is NEVER persisted server-side. It arrives with a single request,
   is used, and is discarded. Storing other people's API credentials in our
   database would make us a target for a breach whose blast radius is somebody
   else's OpenAI billing, which is not a liability worth taking on. */

const MODELS = { main: "gpt-5.1", fast: "gpt-5.1-mini" };

export async function callModel(messages, systemText, { tier = "main", maxTokens = 1000, userKey } = {}) {
  /* route.js now passes an ARRAY of system blocks so Anthropic can put a cache
     breakpoint on the stable doctrine. This provider takes a single string, so
     flatten — without this it would receive "[object Object]" as its entire
     system prompt and silently produce garbage. */
  const sys = Array.isArray(systemText) ? systemText.join("\n\n---\n\n") : systemText;
  if (!userKey) {
    const err = new Error("no_user_key");
    err.userFacing = "No OpenAI key set. Add one in My Kitchen, or switch back to the built-in option.";
    throw err;
  }

  const model = MODELS[tier] || MODELS.main;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userKey}`,
    },
    body: JSON.stringify({
      model,
      // OpenAI takes the system prompt as the first message rather than a
      // separate top-level field the way Anthropic and Gemini do.
      messages: [{ role: "system", content: sys }, ...messages],
      max_completion_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("OpenAI API error", res.status, detail.slice(0, 400));
    const err = new Error("upstream");
    // These three are the user's own account problems, not ours — saying so
    // plainly is much more useful than a generic "couldn't reach the kitchen",
    // because only they can fix it.
    if (res.status === 401) err.userFacing = "That OpenAI key was rejected. Check it in My Kitchen.";
    else if (res.status === 429) err.userFacing = "Your OpenAI account hit its rate limit or is out of credit.";
    else if (res.status === 404) err.userFacing = "Your OpenAI account can't access this model. Check your plan.";
    throw err;
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  if (choice?.finish_reason === "length") {
    console.error("OpenAI hit the token ceiling", { usage: data.usage });
  }

  return (choice?.message?.content || "").trim();
}
