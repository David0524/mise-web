import { NextResponse } from "next/server";
import { requireEntitledUser } from "@/lib/auth";
import { buildDoctrine } from "@/lib/doctrine";
import * as anthropic from "@/lib/providers/anthropic";
import * as gemini from "@/lib/providers/gemini";
import * as openai from "@/lib/providers/openai";

/* This route exists for exactly one reason: the artifact version had to call
   Claude directly from the browser with no key, because Claude.ai's runtime
   proxies that for free. Outside that sandbox there is no such proxy — the
   key has to live somewhere the browser can't read it, which is here.

   The provider is a swap, not a rewrite. Both provider modules take the exact
   same (messages, systemText, opts) shape and return the exact same plain
   string — so this route, and everything upstream of it (every prompt in
   components/MiseApp.jsx, the doctrine, parseJSON's truncation repair) is
   completely unaware which one is actually answering. Set AI_PROVIDER=gemini
   to use Google's free tier; leave it unset (or "anthropic") to use Claude. */
const PROVIDERS = { anthropic, gemini, openai };
const serverProvider = PROVIDERS[process.env.AI_PROVIDER] || PROVIDERS.anthropic;

/* Providers a user is allowed to nominate with their own key. Deliberately a
   allowlist rather than trusting the client's string — otherwise the request
   body could name any module in PROVIDERS and route around the server config. */
const BYOK_PROVIDERS = { openai, anthropic };

export async function POST(req) {
  const auth = await requireEntitledUser();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { messages, tier, maxTokens, sessionContext, userProvider, userKey, docSlices } = body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Restrictions, allergies, equipment, spice ceiling — this is what makes a
  // response actually about the person asking rather than a generic answer.
  // It travels with the request because the server has no session-level
  // memory of who's calling beyond the auth cookie already checked above.
  /* Two blocks, NOT one concatenated string. The doctrine is stable across a
     conversation; the profile changes whenever anything about the household
     does — and it changes more often now that it carries a palate model derived
     from a growing history. Gluing them together meant one cache entry keyed on
     both, so every profile change invalidated the doctrine too: full price and
     full latency on however many doctrine tokens, over and over. Split, the
     doctrine stays a cheap cache read (Anthropic) and only the small profile
     block is ever re-read at full cost.

     Which doctrine, though, is now the caller's choice via `docSlices` — the
     build script's own design was "the app injects only the slices a given
     call needs," which the app never actually did. An unset/empty/unrecognized
     list falls back to everything, so an older client or a typo degrades to
     the previous (correct, just wasteful) behavior rather than running with no
     doctrine at all. */
  const systemBlocks = [buildDoctrine(docSlices)];
  if (sessionContext) systemBlocks.push(sessionContext);

  // Recipe-writing calls need real headroom — a full recipe with 12 steps, prep
  // state on every ingredient, and doneness/seasoning notes runs to roughly 1,200
  // tokens at the schema's own stated limits. The default stays cheap for
  // everything else; callers that write a full recipe ask for more explicitly,
  // capped so a client can't just request an arbitrarily expensive completion.
  const tokenCap = Math.min(Math.max(Number(maxTokens) || 1000, 1), 2200);

  /* If the person brought their own key, use it — their account pays, and the
     key exists only for the life of this request. It is never written to the
     database, never logged, and not retained after the call returns. */
  const byok = userKey && BYOK_PROVIDERS[userProvider];
  const active = byok || serverProvider;

  try {
    const text = await active.callModel(messages, systemBlocks, {
      tier,
      maxTokens: tokenCap,
      ...(byok ? { userKey } : {}),
    });
    return NextResponse.json({ text });
  } catch (e) {
    // Deliberately not logging the error object wholesale on the BYOK path —
    // a thrown request object could carry the key into the log.
    console.error("chat route failure", byok ? `(byok:${userProvider}) ${e.message}` : e);
    return NextResponse.json(
      { error: "network", detail: e.userFacing || null },
      { status: 502 }
    );
  }
}
