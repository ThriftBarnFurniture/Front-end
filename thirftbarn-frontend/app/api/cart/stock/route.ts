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
      return NextResponse.json({ stock: {} });
    }

    const { data, error } = await supabase
      .from("products")
      .select("id,quantity")
      .in("id", productIds);

    if (error) throw new Error(error.message);

    // If quantity is null, treat as "no cap" (infinite) on the client.
    const stock: Record<string, number | null> = {};
    for (const p of data || []) stock[p.id] = p.quantity;

    return NextResponse.json({ stock });
  } catch (e: any) {
    return new NextResponse(e?.message || "Failed to fetch stock.", { status: 500 });
  }
}
