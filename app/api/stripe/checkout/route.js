import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { PLANS, INTRO } from "@/lib/billing";
import { ensureSchema } from "@/lib/schema";

/* Sends the user to Stripe Checkout for the plan they picked.

   The $1 first month is a 30-day trial plus a one-time $1 line item: Stripe
   charges the $1 today, then the plan's normal price when the trial ends. It
   works the same for monthly and yearly, and it's offered once per account
   (intro_used is set by the webhook when any checkout completes).

   Prices: STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY if you've created them in
   the Stripe dashboard; otherwise the price is defined inline from
   lib/billing.js, so no dashboard setup is needed beyond the secret key. */
export async function POST(req) {
  /* Every path returns JSON: a Stripe or database throw used to escape as a
     500 with an empty body, and the page showed the person a raw
     "Unexpected end of JSON input". */
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const plan = PLANS[body?.plan] || PLANS.monthly;

    await ensureSchema();
    const { rows } = await query(
      `select u.email, s.stripe_customer_id, s.stripe_subscription_id, s.intro_used
         from users u left join subscriptions s on s.user_id = u.id where u.id = $1`,
      [userId]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    const intro = !(row.intro_used || row.stripe_subscription_id);

    const recurring = process.env[plan.env]
      ? { price: process.env[plan.env], quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            unit_amount: plan.amount,
            recurring: { interval: plan.interval },
            product_data: { name: `Mise ${plan.label}` },
          },
          quantity: 1,
        };
    const line_items = [recurring];
    if (intro) {
      line_items.push({
        price_data: { currency: "usd", unit_amount: INTRO.amount, product_data: { name: "Mise — your first month" } },
        quantity: 1,
      });
    }

    const renews = intro
      ? `You pay ${INTRO.price} today for your first month. After ${INTRO.days} days it renews at ${plan.price}${plan.per} until you cancel.`
      : `Renews at ${plan.price}${plan.per} until you cancel.`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: row.stripe_customer_id || undefined,
      customer_email: row.stripe_customer_id ? undefined : row.email || undefined,
      line_items,
      success_url: `${process.env.APP_URL}/app?checkout=success`,
      cancel_url: `${process.env.APP_URL}/pricing?checkout=cancelled`,
      client_reference_id: userId,
      metadata: { userId, plan: plan.id, intro: intro ? "1" : "0" },
      subscription_data: {
        metadata: { userId, plan: plan.id },
        ...(intro ? { trial_period_days: INTRO.days } : {}),
      },
      // Said again right above the pay button, so renewal is never a surprise.
      custom_text: { submit: { message: `${renews} Cancel any time in the app; you keep access until the end of the period you paid for.` } },
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
