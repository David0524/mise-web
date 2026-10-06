import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";

/* Sends the user to Stripe Checkout, standard IAP-equivalent flow for a web
   product. Reuses a stored Stripe customer id across attempts so a person who
   abandons checkout and comes back isn't a brand-new customer every time. */
export async function POST() {
  /* Every path returns JSON: a Stripe or database throw used to escape as a
     500 with an empty body, and the page showed the person a raw
     "Unexpected end of JSON input". */
  try {
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
    // Said again right above the pay button, so renewal is never a surprise.
    custom_text: { submit: { message: "Renews every month until you cancel. Cancel any time in the app; you keep access until the end of the month you paid for." } },
    // Set STRIPE_AUTOMATIC_TAX=1 once Stripe Tax is configured: tax is then
    // calculated and shown here before payment, as the pricing page promises.
    ...(process.env.STRIPE_AUTOMATIC_TAX === "1" ? { automatic_tax: { enabled: true } } : {}),
  });

  return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("checkout failed:", e?.type || e?.code || "", e?.message || e);
    return NextResponse.json(
      { error: "Billing is unavailable right now. Try again in a moment." },
      { status: 502 }
    );
  }
}
