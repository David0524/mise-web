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
   through real production testing — see the git history on this file for
   the full trail. No thinkingConfig field at all is the shape that actually
   works; a generous, scaled total budget compensates for whatever default
   thinking consumes rather than trying to suppress it. */
const THINKING_HEADROOM = 3000;

/* Multiple free-tier keys, tried in rotation on a rate limit specifically.
   GEMINI_API_KEYS is a comma-separated list; GEMINI_API_KEY (singular)
   still works on its own for backward compatibility with an existing
   single-key setup — nothing breaks if this isn't adopted. */
function getKeys() {
  const multi = process.env.GEMINI_API_KEYS;
  if (multi) {
    const keys = multi.split(",").map((k) => k.trim()).filter(Boolean);
    if (keys.length) return keys;
  }
  return process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
}

// Remembers which key last worked, so a run of calls doesn't keep re-trying
// an exhausted key #1 first every single time — it picks up roughly where
// it left off. Module-level state in a serverless function is a soft
// optimization, not a correctness requirement: a cold start just resets it
// to the beginning, and the per-request rotation below still works correctly
// from there regardless.
let keyIndex = 0;

async function attempt(model, systemText, contents, generationConfig, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig,
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error("upstream");
    err.status = res.status;
    err.detail = detail.slice(0, 500);
    throw err;
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const err = new Error("upstream");
    err.blocked = data.promptFeedback?.blockReason || "no candidates returned";
    throw err;
  }

  console.error(
    "Gemini finishReason:", candidate.finishReason,
    "| thinking:", data.usageMetadata?.thoughtsTokenCount,
    "| answer:", data.usageMetadata?.candidatesTokenCount,
    "| budget:", generationConfig.maxOutputTokens
  );

  return (candidate.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
}

export async function callModel(messages, systemText, { tier = "main", maxTokens = 1000 } = {}) {
  const keys = getKeys();
  if (!keys.length) {
    console.error("Gemini: no API key configured (GEMINI_API_KEY or GEMINI_API_KEYS)");
    throw new Error("upstream");
  }

  const model = MODELS[tier] || MODELS.main;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const generationConfig = { maxOutputTokens: maxTokens + THINKING_HEADROOM };

  let lastErr;
  for (let i = 0; i < keys.length; i++) {
    const idx = (keyIndex + i) % keys.length;
    try {
      const text = await attempt(model, systemText, contents, generationConfig, keys[idx]);
      keyIndex = idx;
      if (keys.length > 1) console.error(`Gemini ok on key #${idx + 1} of ${keys.length}`);
      return text;
    } catch (e) {
      lastErr = e;
      // Only rotate on a genuine rate limit (429) — a different key can't
      // fix a malformed request or a content-policy block, so trying the
      // rest of the keys on those would just waste them for nothing.
      if (e.status !== 429) {
        console.error("Gemini API error", e.status || "(no status)", e.detail || e.blocked || e.message);
        throw new Error("upstream");
      }
      console.error(`Gemini key #${idx + 1} of ${keys.length} rate-limited, rotating`);
    }
  }

  console.error(`All ${keys.length} Gemini key(s) rate-limited`);
  throw new Error("upstream");
}
