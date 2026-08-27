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

/* Measured directly from a real production call: at thinkingLevel "LOW",
   Gemini still spent 958 of a 1000-token budget on thinking alone, leaving 38
   tokens for the actual answer — nowhere near enough. Several rounds of
   trying to find the field/value that reliably suppresses thinking haven't
   produced something verifiable from here, so this stops trying to eliminate
   thinking and instead budgets enough total room for both, based on that
   real measurement plus real margin. Costs a bit more; actually works. */
const THINKING_HEADROOM = 1600;

/* Gemini 2.5+ models think by default, and thinking tokens are billed against
   the same maxOutputTokens budget as the visible answer — with a 1000-token
   cap, thinking alone consumed the whole thing and produced a response cut
   off before it had written a single complete bracket. Turning thinking off
   fixes that at the source, matching how Claude's doctrine was actually
   designed: answer directly, no hidden reasoning pass.

   The field name for doing that is genuinely uncertain from here, and I've
   now been wrong once already (I have no way to test against the live API,
   only your production logs tell me what actually works):
     - thinkingBudget: 0  — the legacy field, backward-compatible on paper,
       but rejected outright (400) on gemini-3.6-flash specifically.
     - thinkingLevel: "MINIMAL" — the modern field, but documented to require
       a separate "thought signature" this code doesn't provide, which is its
       own way to 400.
     - thinkingLevel: "LOW" — no such requirement documented, so it's the
       primary attempt below, but still a best guess, not a confirmed fact.

   Rather than ship a fourth single guess and cost another redeploy cycle if
   it's also wrong, this tries the modern field first and falls back to no
   thinkingConfig at all — plus a larger token budget, as partial
   compensation for no longer being able to explicitly disable thinking — if
   Gemini rejects the shape outright. Either path is logged, so it's obvious
   from the logs which one actually ran. */
async function attempt(model, systemText, contents, generationConfig) {
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
    const reason = data.promptFeedback?.blockReason || "no candidates returned";
    const err = new Error("upstream");
    err.blocked = reason;
    throw err;
  }

  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    console.error("Gemini finishReason:", candidate.finishReason, "| usage:", data.usageMetadata);
  }

  return (candidate.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
}

export async function callModel(messages, systemText, { tier = "main", maxTokens = 1000 } = {}) {
  const model = MODELS[tier] || MODELS.main;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Measured proof this needed to change: at thinkingLevel "LOW", thinking
  // consumed ~96% of the budget at BOTH 1000 and 2600 tokens — a near-constant
  // PERCENTAGE, not a fixed amount. That means padding the budget can't work;
  // thinking scales up to eat almost all of whatever room exists, no matter
  // how much room that is. "LOW" was never actually limiting anything.
  // Requesting a hard zero instead — worth retrying now specifically because
  // deployment reliability is confirmed (the LOW request above got a real
  // 200, not a 400), so if thinkingBudget:0's earlier rejection was really
  // the stale-deployment confusion rather than a true rejection, this is the
  // fair, clean retest of that.
  try {
    const text = await attempt(model, systemText, contents, {
      maxOutputTokens: maxTokens + THINKING_HEADROOM,
      thinkingConfig: { thinkingBudget: 0 },
    });
    console.error("Gemini ok via thinkingBudget:0");
    return text;
  } catch (e) {
    // Only fall back on a genuine "this request shape is wrong" signal (400).
    // A rate limit or server error would just fail the same way twice —
    // retrying with a different body wouldn't help and burns free-tier quota
    // for nothing.
    if (e.status !== 400) {
      const err = new Error("upstream");
      // Temporary — attached so the real cause is visible right in the app's
      // own error message, not just server logs that have been hard to copy
      // correctly over chat. Strip this once things are confirmed working.
      err.debugInfo = `[PRIMARY-NON400 status=${e.status || "none"} detail=${(e.detail || e.message || "").slice(0, 200)}]`;
      throw err;
    }
    console.error("Gemini rejected thinkingBudget:0 shape (400), falling back:", e.detail);

    try {
      const text = await attempt(model, systemText, contents, {
        maxOutputTokens: Math.max(maxTokens, 2000) + THINKING_HEADROOM,
      });
      console.error("Gemini ok via fallback (no thinkingConfig)");
      return text;
    } catch (e2) {
      console.error("Gemini fallback also failed", e2.status || "(no status)", e2.detail || e2.blocked || e2.message);
      const err = new Error("upstream");
      err.debugInfo = `[FALLBACK-FAILED primary_status=400 primary_detail=${(e.detail || "").slice(0, 150)} | fallback_status=${e2.status || "none"} fallback_detail=${(e2.detail || e2.blocked || e2.message || "").slice(0, 150)}]`;
      throw err;
    }
  }
}
