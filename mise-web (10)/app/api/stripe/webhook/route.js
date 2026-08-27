import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";

/* The only place subscription status actually changes. Everything else in the
   app just reads what this wrote. Signature verification is not optional —
   without it, anyone could POST a fake "subscription active" event and get
   free access. Uses the raw request body on purpose: Stripe signs the exact
   bytes it sent, and re-serialising parsed JSON can produce different bytes
   and fail verification even for a genuine event. */
export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed", err.message);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // Fired once, right after successful checkout. Its only job here is
      // linking the Stripe customer to our user id for the first time.
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (userId && session.customer) {
          await query(
            `insert into subscriptions (user_id, status, stripe_customer_id, stripe_subscription_id)
             values ($1, 'active', $2, $3)
             on conflict (user_id) do update set
               stripe_customer_id = excluded.stripe_customer_id,
               stripe_subscription_id = excluded.stripe_subscription_id`,
            [userId, session.customer, session.subscription]
          );
        }
        break;
      }

      // The actual source of truth going forward: renewals, upgrades,
      // cancellations, and payment failures all land here.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        if (userId) {
          await query(
            `insert into subscriptions (user_id, status, stripe_customer_id, stripe_subscription_id, current_period_end)
             values ($1, $2, $3, $4, $5)
             on conflict (user_id) do update set
               status = excluded.status,
               stripe_customer_id = excluded.stripe_customer_id,
               stripe_subscription_id = excluded.stripe_subscription_id,
               current_period_end = excluded.current_period_end,
               updated_at = now()`,
            [userId, sub.status, sub.customer, sub.id, periodEnd]
          );
        } else {
          // Metadata can be missing if the subscription was edited in the
          // Stripe dashboard rather than created through our checkout flow.
          // Fall back to matching by customer id instead of silently dropping it.
          await query(
            `update subscriptions set status = $2, current_period_end = $3, updated_at = now()
             where stripe_customer_id = $1`,
            [sub.customer, sub.status, periodEnd]
          );
        }
        break;
      }

      default:
        break; // plenty of other event types exist; nothing else to do with them here
    }
  } catch (e) {
    console.error("Webhook handling failed", event.type, e);
    // Return 500 so Stripe retries — better to process an event twice
    // (each write here is idempotent) than to silently drop one.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
