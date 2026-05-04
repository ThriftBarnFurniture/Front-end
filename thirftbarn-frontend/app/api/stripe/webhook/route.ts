import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { fulfillStripeCheckoutSession } from "@/lib/stripe-fullfillment";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "@/lib/brevo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  // Only process what we care about, but always return 200 for known events
  if (event.type === "checkout.session.completed") {
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      const order = await fulfillStripeCheckoutSession(session);

      if (!order.duplicate) {
        const emailPayload = {
          orderId: order.order_id,
          orderNumber: order.order_number,
          status: order.status,
          purchaseDate: order.purchase_date,
          subtotal: order.subtotal,
          shippingCost: order.shipping_cost,
          promoCode: order.promo_code,
          promoDiscount: order.promo_discount,
          tax: order.tax,
          total: order.total,
          currency: order.currency,
          customerName: order.customer_name,
          customerEmail: order.customer_email ?? order.stripe_email,
          customerPhone: order.customer_phone,
          shippingMethod: order.shipping_method,
          shippingAddress: order.shipping_address,
          paymentId: order.payment_id,
          stripeSessionId: order.stripe_session_id ?? session.id,
          items: order.items,
        };

        // Don't let email failure cause a webhook retry
        await sendAdminOrderEmail(emailPayload).catch((e) =>
          console.error("Admin email failed:", e)
        );
        await sendCustomerOrderEmail(emailPayload).catch((e) =>
          console.error("Customer order confirmation failed:", e)
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Webhook fulfillment failed:", message);
      // Return 500 so Stripe retries — your idempotency check handles duplicates
      return new NextResponse("Fulfillment error", { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

// export async function POST(req: Request) {
//   const stripe = getStripe();
//   const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

//   if (!webhookSecret) {
//     return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
//   }

//   let event: Stripe.Event;

//   try {
//     const rawBody = await req.text();
//     const sig = req.headers.get("stripe-signature");
//     if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

//     event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
//   } catch (err: unknown) {
//     const message = err instanceof Error ? err.message : String(err);
//     return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
//   }

//   const res = NextResponse.json({ received: true });

//   Promise.resolve().then(async () => {
//     try {
//       if (event.type !== "checkout.session.completed") return;

//       const session = event.data.object as Stripe.Checkout.Session;
//       const order = await fulfillStripeCheckoutSession(session);

//       if (order.duplicate) return;

//       try {
//         await sendAdminOrderEmail({
          
//         });
//       } catch (emailErr: unknown) {
//         const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
//         console.error("Admin email failed:", message);
//       }
//     } catch (err: unknown) {
//       const message = err instanceof Error ? err.message : String(err);
//       console.error("Webhook fulfillment failed:", message);
//     }
//   });

//   return res;
// }

