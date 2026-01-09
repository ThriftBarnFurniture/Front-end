import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";

export async function POST(_: Request, ctx: { params: { orderId: string } }) {
  try {
    await requireAdmin();

    const supabase = createSupabaseAdmin();
    const orderId = ctx.params.orderId;

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("order_id,status,payment_id,items,amount_total_cents,currency")
      .eq("order_id", orderId)
      .single();

    if (oErr) throw new Error(oErr.message);

    if (!order.payment_id) {
      return new NextResponse("Order missing payment_id (Stripe payment_intent).", { status: 400 });
    }

    const status = String(order.status);
    if (status !== "paid" && status !== "fulfilled") {
      return new NextResponse("Only paid/fulfilled orders can be refunded.", { status: 400 });
    }

    // Full refund (Stripe)
    const refund = await stripe.refunds.create({
      payment_intent: order.payment_id,
    });

    // Update order
    const { error: updErr } = await supabase
      .from("orders")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        stripe_refund_id: refund.id,
      })
      .eq("order_id", orderId);

    if (updErr) throw new Error(updErr.message);

    // Restock inventory + log
    const items = Array.isArray(order.items) ? order.items : [];
    for (const it of items) {
      const productId = String(it.product_id);
      const qty = Math.max(1, Math.floor(Number(it.quantity || 1)));

      // increment quantity (read current then write)
      const { data: p, error: pErr } = await supabase
        .from("products")
        .select("quantity")
        .eq("id", productId)
        .single();
      if (pErr) throw new Error(pErr.message);

      const newQty = (Number(p.quantity) || 0) + qty;

      const { error: qErr } = await supabase
        .from("products")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", productId);
      if (qErr) throw new Error(qErr.message);

      const { error: logErr } = await supabase.from("inventory_events").insert({
        product_id: productId,
        delta: qty,
        reason: "refund",
        source: "stripe_web",
        order_id: orderId,
        created_at: new Date().toISOString(),
      });
      if (logErr) throw new Error(logErr.message);
    }

    return NextResponse.json({ ok: true, refund_id: refund.id });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Refund failed.", { status: 500 });
  }
}
