import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { fulfillStripeCheckoutSession } from "@/lib/stripe-fullfillment";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "@/lib/brevo";
import { isPaymentSettled } from "@/lib/checkout-validation";
import { rateLimitRequest } from "@/lib/request-limits";

type Body = {
  sessionId?: string;
};
export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = rateLimitRequest(req, "confirm-payment", 30, 60_000);
  if (limited) return limited;
  try {
    const stripe = getStripe();
    const body = (await req.json()) as Body;
    const sessionId = String(body?.sessionId || "");
    if (!/^cs_(test_|live_)?[a-zA-Z0-9]+$/.test(sessionId) || sessionId.length > 255) {
      return new NextResponse("Missing session id.", { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!isPaymentSettled(session.payment_status, session.amount_total)) {
      return NextResponse.json({ confirmed: false, status: "pending" }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }

    const result = await fulfillStripeCheckoutSession(session);

    if (!result.duplicate && !result.effectsManaged) {
      const emailPayload = {
        orderId: result.order_id,
        orderNumber: result.order_number,
        status: result.status,
        purchaseDate: result.purchase_date,
        subtotal: result.subtotal,
        shippingCost: result.shipping_cost,
        promoCode: result.promo_code,
        promoDiscount: result.promo_discount,
        tax: result.tax,
        total: result.total,
        currency: result.currency,
        customerName: result.customer_name,
        customerEmail: result.customer_email ?? result.stripe_email,
        customerPhone: result.customer_phone,
        shippingMethod: result.shipping_method,
        shippingAddress: result.shipping_address,
        paymentId: result.payment_id,
        stripeSessionId: result.stripe_session_id ?? session.id,
        items: result.items,
      };

      try {
        await sendAdminOrderEmail(emailPayload);
      } catch (emailErr: unknown) {
        const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error("Admin email failed:", message);
      }

      try {
        await sendCustomerOrderEmail(emailPayload);
      } catch (emailErr: unknown) {
        const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error("Customer order confirmation failed:", message);
      }
    }

    // Customer details are only returned by the receipt endpoint after its
    // separate access check. This endpoint verifies and completes payment.
    return NextResponse.json({ received: true, confirmed: true, status: result.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to finalize checkout.";
    console.error("Checkout completion failed:", message);
    return NextResponse.json({ error: "We could not confirm your order yet. Please try again shortly." }, { status: 500 });
  }
}
