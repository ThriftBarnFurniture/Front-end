import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { fulfillStripeCheckoutSession } from "@/lib/stripe-fullfillment";
import Stripe from "stripe";
import { sendAdminOrderEmail } from "@/lib/brevo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

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

      const order = await fulfillStripeCheckoutSession(session);

      await sendAdminOrderEmail({
        orderNumber: (order as any).order_number ?? (order as any).order_id ?? null,
        total: (order as any).total ?? null,
        currency: (order as any).currency ?? "CAD",
        customerEmail: (order as any).customer_email ?? (order as any).stripe_email ?? null,
        customerName: session.customer_details?.name ?? null,
        customerPhone: session.customer_details?.phone ?? null,
        shippingAddress: (order as any).shipping_address ?? null,
        items: (order as any).items ?? [],
        stripeSessionId: (order as any).stripe_session_id ?? session.id,
      });
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    // For production, it's better to return 500 so Stripe retries if something fails.
    return new NextResponse(`Webhook handler error: ${err.message}`, { status: 500 });
  }
}
