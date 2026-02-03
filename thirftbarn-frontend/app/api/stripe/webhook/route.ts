import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { fulfillStripeCheckoutSession } from "@/lib/stripe-fullfillment";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfillStripeCheckoutSession(session);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    // For production, it's better to return 500 so Stripe retries if something fails.
    return new NextResponse(`Webhook handler error: ${err.message}`, { status: 500 });
  }
}
