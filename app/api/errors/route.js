import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { overLimit } from "@/lib/limits";
import { saveClientError } from "@/lib/telemetry";

/* Errors the app reports about itself (see reportError in components/MiseApp.jsx).
   Guests too, since onboarding breaks before anyone has an account. Always
   answers 204: a failed report is never shown to anyone.

   Signed-in reports are capped per person in the database. Guests have no id
   to count by, so each server instance takes at most GUEST_CAP of them a
   minute; serverless instances don't share memory, which is fine for a cap
   whose only job is stopping a runaway loop. */
const GUEST_CAP = 30;
let guestWindow = 0;
let guestCount = 0;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = await getSessionUserId().catch(() => null);
    if (userId) {
      if (await overLimit(userId, "errors")) return new NextResponse(null, { status: 204 });
    } else {
      const minute = Math.floor(Date.now() / 60000);
      if (minute !== guestWindow) { guestWindow = minute; guestCount = 0; }
      if (++guestCount > GUEST_CAP) return new NextResponse(null, { status: 204 });
    }
    await saveClientError(userId, { message: body?.message, stack: body?.stack, context: body?.context });
  } catch (_) { /* ignore */ }
  return new NextResponse(null, { status: 204 });
}
