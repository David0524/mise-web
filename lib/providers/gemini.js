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
//
// Back on 3.6 Flash for "main", which is the only Flash model this app has
// ever actually been observed working on.
//
// The 3.8 Flash attempt (2026-09-03) failed in production immediately: ideas
// returned HTTP 502 with no detail, which is this route's response when the
// provider throws. 3.8 IS documented as free-tier on Standard — checked on
// the pricing page the same day, input/output/caching all "Free of charge" —
// so the docs and the observed behaviour disagree, exactly as they did for
// 3.7 Flash three weeks earlier.
//
// That is now twice. The pattern worth trusting is the empirical one: a newly
// released Flash model listed as free-tier does not reliably serve these keys
// on day one, whatever the pricing page says. Do not adopt a new Flash model
// on release. Wait, and test with scripts/test-gemini.mjs against a real key
// BEFORE changing this line — that script calls this exact module with no
// database or deploy involved, and would have caught both of these in one
// command instead of a production 502.
const MODELS = { main: "gemini-3.6-flash", fast: "gemini-3.5-flash-lite" };

/* Last resort if the configured model isn't actually servable. See the note on
   MODEL_UNAVAILABLE below — this exists because a model name is the one piece
   of this provider's config that has broken twice, and a name that Google has
   retired or gated should degrade to a working model rather than take the
   whole app down. Must always be a model known to work. */
const FALLBACK_MODEL = "gemini-3.6-flash";

/* A model that doesn't exist, has been retired, or isn't available to this key
   comes back as 404, or as 400 with a message naming the model. Neither is
   retryable and neither is key-specific — every key would fail identically —
   so the rotation logic below correctly refuses to burn the other keys on it,
   and the call fails on the first attempt. That is the right behaviour for a
   genuinely malformed request, but for a bad model NAME it means one wrong
   string takes down every AI feature instantly. */
function isModelUnavailable(e) {
  if (e.status === 404) return true;
  return e.status === 400 && /not found|not supported|unsupported|invalid.*model|model.*invalid/i.test(e.detail || "");
}

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
   single-key setup — nothing breaks if this isn't adopted.

   IMPORTANT, and the thing that makes or breaks this whole scheme: Google
   applies rate limits PER PROJECT, not per API key. Several keys minted
   inside one Google Cloud project all draw down the same quota, so rotating
   between them buys exactly nothing. This deployment's 4 keys are in 4
   separate Google accounts, hence 4 separate projects, so each genuinely has
   its own quota and the rotation is real. If keys are ever added, they have
   to come from a different account to be worth anything. */
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

/* Time budget for the whole call, all keys and retries included.

   ATTEMPT_MS is how long any single request gets; BUDGET_MS caps the total so
   a chain of hangs can't run away (the 100s incident). 30s is enough for the
   heaviest call in this app to land when it's actually working.

   BUDGET_MS must stay meaningfully BELOW `maxDuration` in the route (60s), not
   merely equal to it: the budget only bounds time spent inside this file, and
   auth, the request body, JSON serialization and the response all happen
   outside it. At 55s the worst case measured 55s of provider time, leaving
   almost nothing — 45s keeps the failure inside this route's own error
   handling instead of becoming a platform kill, which would bypass the
   rotation logic entirely and give the person a generic gateway error. */
const ATTEMPT_MS = 30000;
const BUDGET_MS = 45000;

async function attempt(model, systemText, contents, generationConfig, apiKey, deadline) {
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
  // History: was 25s, then cut to 15s because a real production failure hit
  // all 4 keys and took exactly 100s (4 x 25s) — every key hung to the full
  // timeout rather than failing fast.
  //
  // 15s flat then caused the OPPOSITE failure: the heaviest call in the app
  // (the week's ideas — largest doctrine slice, longest prompt, most
  // structured output) needs more than 15s even when it's working perfectly,
  // so every key "timed out", all 4 burned, and the log read "All 4 Gemini
  // key(s) failed — last status 504" with 504 being this file's own
  // synthesized status, not anything Gemini said.
  //
  // So: a TOTAL budget instead of a flat per-attempt cap. The first attempt
  // gets real room for a genuinely slow response to land; each later attempt
  // gets whatever is left. Total is bounded either way, which is the property
  // the 15s change was actually protecting — it just bought it by starving
  // the slow-but-working case.
  const remaining = deadline - Date.now();
  const timeoutMs = Math.min(ATTEMPT_MS, remaining);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      err.detail = `no response within ${Math.round(timeoutMs / 1000)}s`;
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

  let model = MODELS[tier] || MODELS.main;
  const deadline = Date.now() + BUDGET_MS;
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
      /* Out of budget: stop rather than firing a request that can only be
         aborted a moment later. Without this the loop keeps starting attempts
         with a near-zero timeout, turning one real failure into a burst of
         instant fake 504s that look like every key being broken. */
      if (deadline - Date.now() < 3000) {
        console.error(`Gemini out of time budget (${BUDGET_MS / 1000}s), stopping after key #${idx + 1}`);
        break;
      }
      if (attemptNum > 0) await new Promise((r) => setTimeout(r, 500));
      try {
        const text = await attempt(model, systemText, contents, generationConfig, keys[idx], deadline);
        keyIndex = idx;
        if (keys.length > 1 || attemptNum > 0) {
          console.error(`Gemini ok on key #${idx + 1} of ${keys.length}, attempt ${attemptNum + 1}`);
        }
        return text;
      } catch (e) {
        lastErr = e;
        /* The configured model isn't servable. Swap to a known-good one and
           retry on this same key rather than failing the call — the person
           gets their dinner ideas from a slightly older model instead of an
           error, and the log says loudly that the config is wrong so it still
           gets fixed. Only ever fires once per call, since after the swap
           model === FALLBACK_MODEL. */
        if (isModelUnavailable(e) && model !== FALLBACK_MODEL) {
          console.error(
            `Gemini model "${model}" is not available (${e.status}: ${e.detail || "no detail"}) — ` +
            `falling back to "${FALLBACK_MODEL}". FIX THE MODEL NAME in lib/providers/gemini.js.`
          );
          model = FALLBACK_MODEL;
          continue;
        }
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

    if (deadline - Date.now() < 3000) {
      console.error("Gemini time budget spent, not trying remaining keys");
      break;
    }
  }

  console.error(`All ${keys.length} Gemini key(s) failed — last status ${lastErr?.status}`);
  throw new Error("upstream");
}
