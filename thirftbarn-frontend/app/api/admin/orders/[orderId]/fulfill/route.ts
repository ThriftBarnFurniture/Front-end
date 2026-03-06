import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  try {
    await requireAdmin();

    const supabase = createSupabaseAdmin();

    // ✅ Next 16.1: params can be a Promise
    const { orderId } = await ctx.params;

    if (!orderId) return new NextResponse("Missing orderId", { status: 400 });

    const { data: order, error: getErr } = await supabase
      .from("orders")
      .select("status")
      .eq("order_id", orderId)
      .single();

    if (getErr) throw new Error(getErr.message);

    if (String(order.status).toLowerCase() !== "paid") {
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
