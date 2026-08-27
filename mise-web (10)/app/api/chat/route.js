import { NextResponse } from "next/server";
import { requireEntitledUser } from "@/lib/auth";
import { DOCTRINE_ALL } from "@/lib/doctrine";
import * as anthropic from "@/lib/providers/anthropic";
import * as gemini from "@/lib/providers/gemini";

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
const PROVIDERS = { anthropic, gemini };
const provider = PROVIDERS[process.env.AI_PROVIDER] || PROVIDERS.anthropic;

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

  const { messages, tier, maxTokens, sessionContext } = body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Restrictions, allergies, equipment, spice ceiling — this is what makes a
  // response actually about the person asking rather than a generic answer.
  // It travels with the request because the server has no session-level
  // memory of who's calling beyond the auth cookie already checked above.
  const systemText = sessionContext
    ? `${DOCTRINE_ALL}\n\n---\n\n${sessionContext}`
    : DOCTRINE_ALL;

  // Recipe-writing calls need real headroom — a full recipe with 12 steps, prep
  // state on every ingredient, and doneness/seasoning notes runs to roughly 1,200
  // tokens at the schema's own stated limits. The default stays cheap for
  // everything else; callers that write a full recipe ask for more explicitly,
  // capped so a client can't just request an arbitrarily expensive completion.
  const tokenCap = Math.min(Math.max(Number(maxTokens) || 1000, 1), 2200);

  try {
    const text = await provider.callModel(messages, systemText, { tier, maxTokens: tokenCap });
    return NextResponse.json({ text });
  } catch (e) {
    console.error("chat route failure", e);
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
