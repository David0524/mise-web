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
// "main" confirmed working — Google's own 404 on gemini-2.5-flash named this
// exact replacement. "fast" is the same version bump applied to the same
// pattern, NOT independently confirmed by an error the way main was — if it
// 404s too, the message will name its own correct replacement the same way.
const MODELS = { main: "gemini-3.6-flash", fast: "gemini-3.6-flash-lite" };

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
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Gemini API error", res.status, detail.slice(0, 500));
    throw new Error("upstream");
  }

  const data = await res.json();

  // A safety filter or recitation block returns 200 with an empty candidates
  // array rather than an error — worth surfacing plainly rather than crashing
  // on `.content.parts` of something that doesn't exist.
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const reason = data.promptFeedback?.blockReason || "no candidates returned";
    console.error("Gemini returned nothing usable:", reason);
    throw new Error("upstream");
  }

  return (candidate.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
}
