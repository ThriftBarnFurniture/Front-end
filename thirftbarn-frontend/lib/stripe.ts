/*
Initializes and exports a configured Stripe SDK client using STRIPE_SECRET_KEY.
*/

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

export const stripe = new Stripe(key!, {
  apiVersion: "2024-09-30.acacia" as any,
});
