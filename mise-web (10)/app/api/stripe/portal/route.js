import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";

/* Lets a subscriber manage or cancel their own subscription without you
   building any of that UI — Stripe hosts it. */
export async function POST() {
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
}
