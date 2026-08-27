import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";

/* Sends the user to Stripe Checkout, standard IAP-equivalent flow for a web
   product. Reuses a stored Stripe customer id across attempts so a person who
   abandons checkout and comes back isn't a brand-new customer every time. */
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { rows } = await query(
    "select u.email, s.stripe_customer_id from users u left join subscriptions s on s.user_id = u.id where u.id = $1",
    [userId]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: row.stripe_customer_id || undefined,
    customer_email: row.stripe_customer_id ? undefined : row.email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.APP_URL}/app?checkout=success`,
    cancel_url: `${process.env.APP_URL}/pricing?checkout=cancelled`,
    client_reference_id: userId,
    subscription_data: { metadata: { userId } },
  });

  return NextResponse.json({ url: session.url });
}
