import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";

/* Lets a subscriber manage or cancel their own subscription without you
   building any of that UI — Stripe hosts it. */
export async function POST() {
  /* Every path returns JSON: a Stripe or database throw used to escape as a
     500 with an empty body, and the page showed the person a raw
     "Unexpected end of JSON input". */
  try {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { rows } = await query(
    "select stripe_customer_id from subscriptions where user_id = $1",
    [userId]
  );
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: "no subscription yet" }, { status: 404 });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.APP_URL}/app`,
  });

  return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("portal failed:", e?.type || e?.code || "", e?.message || e);
    return NextResponse.json(
      { error: "Billing is unavailable right now. Try again in a moment." },
      { status: 502 }
    );
  }
}
