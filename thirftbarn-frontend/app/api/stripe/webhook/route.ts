import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { fulfillStripeCheckoutSession } from "@/lib/stripe-fullfillment";
import { sendAdminOrderEmail } from "@/lib/brevo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // This will ALWAYS fail in production if not set.
    return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    // Signature / payload problem
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ✅ ACK STRIPE IMMEDIATELY
  const res = NextResponse.json({ received: true });

  // Do the heavy work AFTER we’ve created the response
  // (This still runs on the same invocation, but you’re no longer risking Stripe timing out waiting for the response.)
  Promise.resolve().then(async () => {
    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        const order = await fulfillStripeCheckoutSession(session);

        // ✅ Email should NOT be allowed to break the webhook
        try {
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
        } catch (emailErr: any) {
          console.error("Admin email failed:", emailErr?.message || emailErr);
        }
      }
    } catch (err: any) {
      console.error("Webhook fulfillment failed:", err?.message || err);
      // IMPORTANT: don’t throw — Stripe already got 200
    }
  });

  return res;
}
