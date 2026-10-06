import { NextResponse } from "next/server";
import { requireEntitledUser } from "@/lib/auth";
import { synthesize, ttsProvider } from "@/lib/tts";

/* Mise reads cook-mode steps aloud. GET says whether a neural voice is
   configured (the client falls back to the phone's own voice if not); POST
   turns one short passage into audio. Signed-in, entitled users only, and
   short passages only — this is a voice for a step, not a general TTS API. */

const MAX_CHARS = 700;
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({ available: !!ttsProvider() });
}

export async function POST(req) {
  const auth = await requireEntitledUser();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let text = "";
  try { text = String((await req.json())?.text || "").trim(); } catch (_) {}
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: "too_long" }, { status: 413 });
  if (!ttsProvider()) return NextResponse.json({ error: "tts_unavailable" }, { status: 501 });
  try {
    const { body, type } = await synthesize(text);
    return new NextResponse(body, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400" } });
  } catch (e) {
    console.error("tts fail", e?.message);
    return NextResponse.json({ error: "tts_failed" }, { status: 502 });
  }
}
