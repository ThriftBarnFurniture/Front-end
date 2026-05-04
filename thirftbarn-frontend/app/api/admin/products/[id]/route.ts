import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";
import { normalizeQuantity } from "@/lib/inventory";
import { getEstateSalePhotoUrl, getEstateSaleSlug, isEstateSaleCollection } from "@/lib/estate-sales";
import { deleteSquareCatalogObjects } from "@/lib/square";
import { deleteProductImagesFromR2 } from "@/lib/r2-upload";

function getProductImageUrls(product: { image_url?: string | null; image_urls?: unknown }) {
  const urls = new Set<string>();

  if (product.image_url) {
    urls.add(product.image_url);
  }

  if (Array.isArray(product.image_urls)) {
    for (const value of product.image_urls) {
      if (typeof value === "string" && value.trim()) {
        urls.add(value);
      }
    }
  }

  return Array.from(urls);
}

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
  const { data: product, error: findError } = await supabase
    .from("products")
    .select("id,square_item_id,square_image_id,image_url,image_urls")
    .eq("id", id)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteSquareCatalogObjects([product.square_item_id, product.square_image_id]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Square delete failed.";
    return NextResponse.json(
      { error: `Failed to delete product from Square: ${message}` },
      { status: 502 }
    );
  }

  try {
    await deleteProductImagesFromR2(getProductImageUrls(product));
  } catch (error) {
    const message = error instanceof Error ? error.message : "R2 delete failed.";
    return NextResponse.json(
      { error: `Failed to delete product images from R2: ${message}` },
      { status: 502 }
    );
  }

  const { data, error } = await supabase.from("products").delete().eq("id", id).select("id").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, id });
}
