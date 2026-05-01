import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";
import { normalizeQuantity } from "@/lib/inventory";
import { getEstateSalePhotoUrl, getEstateSaleSlug, isEstateSaleCollection } from "@/lib/estate-sales";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const collections = Array.isArray(data.collections) ? data.collections : [];
  const estateCollection = collections.find(isEstateSaleCollection);
  let estateSalePhotoUrl = estateCollection ? getEstateSalePhotoUrl(collections, estateCollection) : null;

  if (estateCollection) {
    const { data: estateSale } = await supabase
      .from("estate_sales")
      .select("photo_url")
      .eq("slug", getEstateSaleSlug(estateCollection))
      .maybeSingle();

    estateSalePhotoUrl = estateSale?.photo_url ?? estateSalePhotoUrl;
  }

  return NextResponse.json({
    ...data,
    estate_sale_photo_url: estateSalePhotoUrl,
    quantity: normalizeQuantity(data.quantity),
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("products").delete().eq("id", id).select("id").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, id });
}
