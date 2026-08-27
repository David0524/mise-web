/* Gemini's API shape genuinely differs from Anthropic's, not just the URL:
     - System instructions are a separate top-level field, not a message role.
     - The AI's own turns are role "model", not "assistant".
     - Every message needs its text wrapped in a `parts` array.
     - Output length is generationConfig.maxOutputTokens, not max_tokens.

   Deliberately NOT using Gemini's native responseMimeType: "application/json"
   mode — not every call in this app wants JSON (the stove-side sous-chef reply
   is plain text on purpose), and forcing JSON mode unconditionally would break
   those. Same approach as the Anthropic side: the prompt itself asks for JSON
   where JSON is wanted, and the client's existing parseJSON/truncation-repair
   logic does the rest — so nothing upstream of this file needed to change.
   Native schema enforcement is a real upgrade if this moves past demo use;
   not worth the added surface area for now. */

// Verify these against your own AI Studio console before relying on them —
// exact free-tier model names and availability shift; this isn't a stable
// contract the way Anthropic's dated model strings are.
const MODELS = { main: "gemini-3.6-flash", fast: "gemini-3.6-flash-lite" };

/* Gemini 2.5+ models think by default, and thinking tokens are billed
   against the SAME maxOutputTokens budget as the visible answer. Confirmed
   through real production testing, in order:
     - thinkingConfig: { thinkingBudget: 0 } — the legacy field. Rejected
       outright (400, "invalid argument") on gemini-3.6-flash, consistently,
       confirmed twice after deployment reliability was independently
       established. Not a fluke — this model doesn't accept it.
     - thinkingConfig: { thinkingLevel: "LOW" } — accepted, but measured
       proof it doesn't do what it sounds like: thinking consumed ~96% of
       the budget at BOTH 1000 and 2600 total tokens — a near-constant
       PERCENTAGE, not a fixed amount. Padding the budget on top of this
       setting can't work, since thinking scales up to eat almost all of
       whatever room exists no matter how much room that is.
     - No thinkingConfig field at all — this is the one that actually works.
       Whatever Gemini's true default does here, it leaves enough room for
       a real answer inside a sufficiently large total budget. Confirmed
       working in production.
   So: no thinkingConfig, and a generous total budget scaled to what the
   caller actually needs — not a flat floor, since recipe-writing calls
   need meaningfully more real content (up to 1900 tokens) than a dish-idea
   list does (a few hundred), and a flat floor sized for the short call
   would under-provision the long one. */
const THINKING_HEADROOM = 3000;

export async function callModel(messages, systemText, { tier = "main", maxTokens = 1000 } = {}) {
  const model = MODELS[tier] || MODELS.main;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens + THINKING_HEADROOM },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Gemini API error", res.status, detail.slice(0, 500));
    throw new Error("upstream");
  }

  const data = await res.json();

  const candidate = data.candidates?.[0];
  if (!candidate) {
    const reason = data.promptFeedback?.blockReason || "no candidates returned";
    console.error("Gemini returned nothing usable:", reason);
    throw new Error("upstream");
  }

  // Always logged now, not just on a non-STOP outcome — the earlier version
  // only logged usage on truncation, which meant there was no visibility at
  // all into what a *successful* call's thinking/answer split actually
  // looked like. Worth knowing that, if this needs tuning again.
  console.error(
    "Gemini finishReason:", candidate.finishReason,
    "| thinking:", data.usageMetadata?.thoughtsTokenCount,
    "| answer:", data.usageMetadata?.candidatesTokenCount,
    "| budget:", maxTokens + THINKING_HEADROOM
  );

  return (candidate.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
}
