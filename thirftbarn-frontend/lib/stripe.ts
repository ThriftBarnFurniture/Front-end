/*
Initializes and exports a configured Stripe SDK client using STRIPE_SECRET_KEY.
Safe for Next.js build (doesn't throw at import time).
*/

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe() {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  _stripe = new Stripe(key, {
    apiVersion: "2024-09-30.acacia" as any,
  });

  return _stripe;
}
