import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { logEvent, logRecipe } from "@/lib/events";
import { overLimit } from "@/lib/limits";

/* The app's usage events (see lib/events.js). Always answers 204 so a stats
   problem is never visible to the person using the app. */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = await getSessionUserId();
    if (userId && (await overLimit(userId, "events"))) return new NextResponse(null, { status: 204 });
    if (body?.name === "recipe_generated") await logRecipe(userId, body.recipe, body?.props?.kind);
    else await logEvent(userId, String(body?.name || ""), body?.props);
  } catch (_) { /* ignore */ }
  return new NextResponse(null, { status: 204 });
}
