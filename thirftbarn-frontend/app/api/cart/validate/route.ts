import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Body = { productIds: string[] };

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseAdmin();
    const body = (await req.json()) as Body;

    const productIds = Array.from(
      new Set((body.productIds || []).map((x) => String(x)).filter(Boolean))
    );

    if (productIds.length === 0) {
      return NextResponse.json({ ok: true, outOfStock: [] });
    }

    const { data, error } = await supabase
      .from("products")
      .select("id,name,quantity")
      .in("id", productIds);

    if (error) throw error;

    // Only treat as out of stock if quantity is NOT null and <= 0 (matches your Shop badge logic)
    const outOfStock =
      (data || [])
        .filter((p) => p.quantity !== null && Number(p.quantity) <= 0)
        .map((p) => ({ id: p.id, name: p.name })) ?? [];

    return NextResponse.json({ ok: outOfStock.length === 0, outOfStock });
  } catch (e: any) {
    return new NextResponse(e?.message || "Failed to validate cart.", { status: 500 });
  }
}
