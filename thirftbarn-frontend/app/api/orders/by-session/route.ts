import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const { sessionId } = (await req.json()) as { sessionId?: string };
    const sid = String(sessionId ?? "").trim();
    if (!sid) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("orders")
      .select(
        [
          "order_id",
          "order_number",
          "status",
          "currency",
          "subtotal",
          "tax",
          "total",
          "purchase_date",
          "items",
          "customer_name",
          "customer_email",
          "customer_phone",
          "shipping_address",
          "shipping_cost",
          "promo_code",
          "promo_discount",
          "stripe_email",
          "stripe_session_id",
        ].join(",")
      )
      .eq("stripe_session_id", sid)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ order: null }, { status: 200 });

    return NextResponse.json({ order: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
