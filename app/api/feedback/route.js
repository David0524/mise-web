import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { overLimit } from "@/lib/limits";
import { saveFeedback } from "@/lib/telemetry";
import { logEvent } from "@/lib/events";

/* "Send feedback" from inside the app. Signed-in only, so every note has
   someone to follow up with. The app attaches the screen and device; the
   message is the only thing the person writes. */
export async function POST(req) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to send feedback." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: message ? "That's a bit long — keep it under 2,000 characters." : "Write a note first." }, { status: 400 });
  }
  const limited = await overLimit(userId, "feedback");
  if (limited) return NextResponse.json({ error: limited.message }, { status: 429 });
  if (!(await saveFeedback(userId, message, body?.context))) {
    return NextResponse.json({ error: "Couldn't send that just now. Try again in a moment." }, { status: 500 });
  }
  logEvent(userId, "feedback_note", { v: typeof body?.context?.view === "string" ? body.context.view : "" });
  return NextResponse.json({ ok: true });
}
