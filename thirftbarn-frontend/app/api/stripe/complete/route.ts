import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { fulfillStripeCheckoutSession } from "@/lib/stripe-fullfillment";
import { sendAdminOrderEmail } from "@/lib/brevo";

type Body = {
  sessionId?: string;
};

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const body = (await req.json()) as Body;
    const sessionId = String(body?.sessionId || "");
    if (!sessionId) {
      return new NextResponse("Missing session id.", { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return new NextResponse("Payment not completed.", { status: 400 });
    }

    const result = await fulfillStripeCheckoutSession(session);

    if (!result.duplicate) {
      try {
        await sendAdminOrderEmail({
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
        });
      } catch (emailErr: unknown) {
        const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error("Admin email failed:", message);
      }
    }

    return NextResponse.json({ received: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to finalize checkout.";
    return new NextResponse(message, { status: 500 });
  }
}
