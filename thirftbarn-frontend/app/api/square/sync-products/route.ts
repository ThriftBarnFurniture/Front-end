import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { normalizeQuantity } from "@/lib/inventory";
import { upsertSquareCatalogObject, upsertSquareImageIfPossible } from "@/lib/square/catalog";

type ProductRow = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string | null;
  description: string | null;
  price: number | null;
  quantity: number | null;
  is_active: boolean | null;
  image_url: string | null;

  square_item_id: string | null;
  square_variation_id: string | null;
  square_image_id: string | null;
};

function toSquareProduct(p: ProductRow) {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    price: p.price,
    image_url: p.image_url,
    square_item_id: p.square_item_id,
    square_variation_id: p.square_variation_id,
    square_image_id: p.square_image_id,
    track_inventory: normalizeQuantity(p.quantity) !== null,
  };
}

export async function POST(req: Request) {
  // Simple protection so random people can’t trigger mass sync
  const secret = process.env.POS_SYNC_SECRET;
  if (secret) {
    const provided = req.headers.get("x-pos-sync-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createClient();

  // Pull active products only
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,sku,barcode,name,description,price,quantity,is_active,image_url,square_item_id,square_variation_id,square_image_id"
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1000); // 300-ish is fine

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const products = (data || []) as ProductRow[];

  const results: Array<Record<string, unknown>> = [];
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of products) {
    try {
      const squareProduct = toSquareProduct(p);
      const up = await upsertSquareCatalogObject(squareProduct);

      if (up.skipped) {
        skipped++;
        results.push({ id: p.id, status: "skipped", reason: up.reason });
        continue;
      }

      // Try image (best-effort)
      const squareItemId = up.square_item_id;
      const img = squareItemId
        ? await upsertSquareImageIfPossible(squareProduct, squareItemId)
        : null;
      const squareImageId = img?.image_id ?? null;
      // Save Square IDs back to Supabase for next runs (idempotent)
      const { error: upErr } = await supabase
        .from("products")
        .update({
          square_item_id: up.square_item_id,
          square_variation_id: up.square_variation_id,
          square_image_id: squareImageId,
        })
        .eq("id", p.id);

      if (upErr) {
        // Don't fail the whole sync; just report it
        results.push({
          id: p.id,
          status: "partial",
          square_item_id: up.square_item_id,
          square_variation_id: up.square_variation_id,
          warning: `Supabase update failed: ${upErr.message}`,
        });
      } else {
        results.push({
          id: p.id,
          status: "synced",
          square_item_id: up.square_item_id,
          square_variation_id: up.square_variation_id,
          square_image_id: squareImageId,
        });
      }

      synced++;
    } catch (e: unknown) {
      failed++;
      const message = e instanceof Error ? e.message : "error";
      results.push({ id: p.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    total: products.length,
    synced,
    skipped,
    failed,
    note:
      "Square image sync now uploads the actual file bytes. Source images must be JPG, PNG, or GIF for Square to accept them.",
    results,
  });
}
