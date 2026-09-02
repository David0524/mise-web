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
// Reverted to 3.6 Flash for "main" — 3.7 Flash launched days ago and is free
// inside AI Studio/Antigravity, but priced from day one through the standard
// API this app calls. That's the likely cause of the intermittent failures:
// some keys may have billing enabled, others don't, so which key a request
// lands on determines whether it works at all.
const MODELS = { main: "gemini-3.6-flash", fast: "gemini-3.5-flash-lite" };

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
  /* route.js passes an ARRAY of system blocks so Anthropic can put a cache
     breakpoint on the stable doctrine. Gemini takes one string, so flatten here
     — at the point of use. Without it the request carries "[object Object]" as
     its entire system prompt and the model answers with no doctrine at all,
     which fails silently rather than erroring. */
  const sys = Array.isArray(systemText) ? systemText.join("\n\n---\n\n") : systemText;

  // Gemini occasionally hangs instead of failing fast (no 503, just silence).
  // Without a per-request timeout that hang blocks this single await
  // indefinitely, defeating the whole retry/rotation scheme below and
  // eventually taking down the entire function on Vercel's platform-level
  // timeout instead.
  //
  // Was 25s — a real production failure hit all 4 configured keys and took
  // exactly 100 seconds, which is 4 x 25s: every key hung to the full timeout
  // rather than failing fast. 15s still gives a genuinely slow response real
  // room to land (this app's calls rarely need more than a few seconds when
  // things are actually working), while capping the worst case across 4 keys
  // at 60s instead of 100.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents,
          generationConfig,
        }),
        signal: controller.signal,
      }
    );
  } catch (e) {
    if (e.name === "AbortError") {
      // Treat a hang as its own status (504, not a real Gemini response) so
      // the caller's rotation logic can tell it apart from an actual 503.
      const err = new Error("upstream");
      err.status = 504;
      err.detail = "request timed out with no response";
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

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

    // 503 gets its own short retry loop on THIS key before moving on — a
    // single-key setup (the common case) would otherwise get zero benefit
    // from any of this, since cycling through a one-item key list only ever
    // tries once. A 429 skips this entirely and goes straight to the next
    // key instead: the same key hitting the same exhausted quota again a
    // moment later isn't going to succeed, so there's nothing to wait for.
    // Was 3 attempts per key across up to 4 keys, with real network latency on
    // top — a genuine failure could take well over a minute before the person
    // ever saw an error. 2 attempts is still a real retry for a transient 503,
    // just without making someone wait two minutes to find out it's not working.
    const attemptsOnThisKey = 2;
    for (let attemptNum = 0; attemptNum < attemptsOnThisKey; attemptNum++) {
      if (attemptNum > 0) await new Promise((r) => setTimeout(r, 500));
      try {
        const text = await attempt(model, systemText, contents, generationConfig, keys[idx]);
        keyIndex = idx;
        if (keys.length > 1 || attemptNum > 0) {
          console.error(`Gemini ok on key #${idx + 1} of ${keys.length}, attempt ${attemptNum + 1}`);
        }
        return text;
      } catch (e) {
        lastErr = e;
        if (e.status !== 503) break; // not a "worth retrying same key" failure
        console.error(`Gemini key #${idx + 1} overloaded (503), retry ${attemptNum + 1}/${attemptsOnThisKey} on same key`);
      }
    }

    // Only rotate to the next key for a rate limit (key-specific quota, a
    // different key genuinely has its own), if 503 persisted through all
    // retries on this one, or if the request just hung (504, synthesized by
    // attempt() on our own timeout). A hang skips the same-key retry loop
    // entirely rather than waiting through it three times — a stuck
    // connection is more likely to still be stuck a moment later than a
    // genuinely overloaded server is, so there's more to gain from trying a
    // different key right away than from retrying this one. Anything else —
    // a malformed request, a content block — would fail identically no
    // matter which key sends it, so trying the rest of the keys on those
    // would just waste them for nothing.
    if (lastErr.status !== 429 && lastErr.status !== 503 && lastErr.status !== 504) {
      console.error("Gemini API error", lastErr.status || "(no status)", lastErr.detail || lastErr.blocked || lastErr.message);
      throw new Error("upstream");
    }
    const why =
      lastErr.status === 429 ? "rate-limited" :
      lastErr.status === 504 ? "timed out with no response" :
      "still overloaded after retries";
    console.error(`Gemini key #${idx + 1} of ${keys.length} ${why}, moving to next key`);
  }

  console.error(`All ${keys.length} Gemini key(s) failed — last status ${lastErr?.status}`);
  throw new Error("upstream");
}
