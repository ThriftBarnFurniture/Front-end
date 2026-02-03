import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  try {
    await requireAdmin();
    const stripe = getStripe();
    const supabase = createSupabaseAdmin();
    const { orderId } = await ctx.params;

    if (!orderId) return new NextResponse("Missing orderId", { status: 400 });

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("order_id,status,payment_id,items,amount_total_cents,currency")
      .eq("order_id", orderId)
      .single();

    if (oErr) throw new Error(oErr.message);

    if (!order.payment_id) {
      return new NextResponse("Order missing payment_id (Stripe payment_intent).", {
        status: 400,
      });
    }

    const status = String(order.status ?? "").toLowerCase();
    if (status !== "paid" && status !== "fulfilled") {
      return new NextResponse("Only paid/fulfilled orders can be refunded.", {
        status: 400,
      });
    }

    // Optional pre-check (nice to have)
    try {
        const pi = await stripe.paymentIntents.retrieve(order.payment_id);

        const latestChargeId = pi.latest_charge;
        if (!latestChargeId) {
        return new NextResponse("No charge found for this payment.", { status: 400 });
        }

        const charge = await stripe.charges.retrieve(String(latestChargeId), {
        expand: ["dispute"],
        });

        if (charge.disputed) {
        // Optional: mark DB so UI can disable refund
        await supabase
            .from("orders")
            .update({ status: "chargeback" })
            .eq("order_id", orderId);

        return new NextResponse(
            "This payment has a dispute/chargeback. Stripe does not allow refunds on charged back payments.",
            { status: 400 }
        );
    }

    } catch {
      // If the pre-check fails for any reason, we still attempt refund and handle Stripe errors below.
    }

    // ✅ Full refund — catch Stripe "charged back" errors cleanly
    let refund;
    try {
      refund = await stripe.refunds.create({ payment_intent: order.payment_id });
    } catch (err: any) {
      const msg = String(err?.message ?? "");

      if (msg.toLowerCase().includes("charged back")) {
        // Optional: mark DB so UI can disable refund
        await supabase
          .from("orders")
          .update({ status: "chargeback" })
          .eq("order_id", orderId);

        return new NextResponse(
          "This payment was charged back (dispute). Stripe does not allow refunds for chargebacks.",
          { status: 400 }
        );
      }

      throw err;
    }

    const { error: updErr } = await supabase
      .from("orders")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        stripe_refund_id: refund.id,
      })
      .eq("order_id", orderId);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ ok: true, refund_id: refund.id });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Refund failed.", { status: 500 });
  }
}
