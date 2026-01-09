import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(_: Request, ctx: { params: { orderId: string } }) {
  try {
    await requireAdmin();

    const supabase = createSupabaseAdmin();
    const orderId = ctx.params.orderId;

    const { data: order, error: getErr } = await supabase
      .from("orders")
      .select("status")
      .eq("order_id", orderId)
      .single();

    if (getErr) throw new Error(getErr.message);

    if (String(order.status) !== "paid") {
      return new NextResponse("Only paid orders can be fulfilled.", { status: 400 });
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("order_id", orderId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Failed to fulfill.", { status: 500 });
  }
}
