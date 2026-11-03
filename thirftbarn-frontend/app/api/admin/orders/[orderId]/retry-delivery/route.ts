import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { retryStripeOrderDelivery } from "@/lib/stripe-fullfillment";

export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  await requireAdmin();
  if (process.env.STRIPE_ATOMIC_FULFILLMENT !== "true") {
    return NextResponse.json({ error: "Atomic fulfillment is not enabled." }, { status: 503 });
  }
  const { orderId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }
  try {
    const pending = await retryStripeOrderDelivery(orderId);
    return NextResponse.json({ ok: !pending, pending }, { status: pending ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Delivery is still pending. Please try again shortly." }, { status: 503 });
  }
}
