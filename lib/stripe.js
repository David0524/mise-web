import Stripe from "stripe";

const g = globalThis;
export const stripe =
  g.__miseStripe || (g.__miseStripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  }));
