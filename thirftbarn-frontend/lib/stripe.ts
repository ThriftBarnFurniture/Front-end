/*
Initializes and exports a configured Stripe SDK client using STRIPE_SECRET_KEY.
*/

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-09-30.acacia" as any,
});
