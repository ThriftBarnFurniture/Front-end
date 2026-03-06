import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe() {
  const key =
    process.env.STRIPE_SECRET_KEY ||
    process.env.DEV_STRIPE_SECRET_KEY ||
    process.env.PROD_STRIPE_SECRET_KEY;

  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  if (!cached) {
    cached = new Stripe(key, {
      apiVersion: "2024-09-30.acacia" as any,
    });
  }

  return cached;
}
