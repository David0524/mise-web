import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

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

  /* Stripe does not deliver events in order, and a retried event can arrive
     after newer ones. Every write below is therefore conditional on this
     event being at least as new as the last one applied to that row —
     otherwise a late "active" resurrects a subscription that was cancelled
     after it. */
  const created = Number(event.created) || 0;
  const NEWER = `coalesce(subscriptions.stripe_event_created, 0) <= excluded.stripe_event_created`;

  try {
    await ensureSchema();
    switch (event.type) {
      // Fired once, right after successful checkout. Links the Stripe customer
      // to our user id AND grants access: signup always pre-creates a 'none'
      // row, so the old insert-only 'active' never applied and a paying
      // customer bounced off the paywall until a subscription event happened
      // to arrive.
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (userId && session.customer) {
          await query(
            // intro_used: any completed checkout spends the $1 first month,
            // so cancelling and resubscribing doesn't get it again.
            `insert into subscriptions (user_id, status, stripe_customer_id, stripe_subscription_id, stripe_event_created, intro_used)
             values ($1, 'active', $2, $3, $4, true)
             on conflict (user_id) do update set
               status = case when ${NEWER} then 'active' else subscriptions.status end,
               intro_used = true,
               stripe_customer_id = excluded.stripe_customer_id,
               stripe_subscription_id = excluded.stripe_subscription_id,
               stripe_event_created = greatest(coalesce(subscriptions.stripe_event_created, 0), excluded.stripe_event_created),
               updated_at = now()`,
            [userId, session.customer, session.subscription, created]
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
          /* Also skipped: an event about a DIFFERENT subscription than the one
             on file, unless it's the newer one. Without this, the deletion of
             someone's old subscription could cancel the one they just bought. */
          await query(
            `insert into subscriptions (user_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, stripe_event_created)
             values ($1, $2, $3, $4, $5, $6)
             on conflict (user_id) do update set
               status = excluded.status,
               stripe_customer_id = excluded.stripe_customer_id,
               stripe_subscription_id = excluded.stripe_subscription_id,
               current_period_end = excluded.current_period_end,
               stripe_event_created = excluded.stripe_event_created,
               updated_at = now()
             where ${NEWER}
               and not (excluded.status in ('canceled', 'incomplete_expired')
                        and subscriptions.stripe_subscription_id is not null
                        and subscriptions.stripe_subscription_id <> excluded.stripe_subscription_id)`,
            [userId, sub.status, sub.customer, sub.id, periodEnd, created]
          );
        } else {
          // Metadata can be missing if the subscription was edited in the
          // Stripe dashboard rather than created through our checkout flow.
          // Fall back to matching by customer id instead of silently dropping it.
          await query(
            `update subscriptions set status = $2, current_period_end = $3, stripe_event_created = $4, updated_at = now()
             where stripe_customer_id = $1
               and coalesce(stripe_event_created, 0) <= $4
               and (stripe_subscription_id is null or stripe_subscription_id = $5)`,
            [sub.customer, sub.status, periodEnd, created, sub.id]
          );
        }
        break;
      }

      default:
        break; // plenty of other event types exist; nothing else to do with them here
    }
  } catch (e) {
    /* An event naming a user that doesn't exist (deleted account, or metadata
       that isn't one of our ids) will fail identically on every retry. Returning
       500 made Stripe retry it for days; acknowledge it and log it instead. */
    if (e?.code === "23503" || e?.code === "22P02") {
      console.error("Webhook references an unknown user; acknowledged without applying", event.type, event.id);
      return NextResponse.json({ received: true, applied: false });
    }
    console.error("Webhook handling failed", event.type, e);
    // Return 500 so Stripe retries — better to process an event twice
    // (each write here is idempotent) than to silently drop one.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
