import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { fulfillStripeCheckoutSession } from "@/lib/stripe-fullfillment";

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
    return NextResponse.json({ received: true, ...result });
  } catch (err: any) {
    return new NextResponse(err?.message || "Failed to finalize checkout.", { status: 500 });
  }
}
