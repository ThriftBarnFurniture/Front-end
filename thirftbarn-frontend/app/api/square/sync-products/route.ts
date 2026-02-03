import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

const SQUARE_API_BASE = "https://connect.squareup.com/v2";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function toCents(price: number) {
  // price is numeric in dollars (ex: 19.99) -> cents integer
  return Math.round(price * 100);
}

async function squareFetch(path: string, init: RequestInit) {
  const token = requireEnv("SQUARE_ACCESS_TOKEN");
  const res = await fetch(`${SQUARE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.detail ||
      json?.errors?.[0]?.code ||
      `Square API error (${res.status})`;
    throw new Error(`${msg} :: ${path}`);
  }
  return json;
}

/**
 * Creates or updates ONE Square item + variation using Catalog API.
 * If square IDs exist, we update existing objects. Otherwise we create new.
 */
async function upsertSquareCatalogObject(p: ProductRow) {
  const currency = process.env.SQUARE_CURRENCY || "CAD";

  if (!p.name || p.price == null) {
    return { skipped: true, reason: "missing name/price" as const };
  }

  const itemName = p.name.trim();
  const itemDesc = (p.description || "").trim().slice(0, 4096);

  // Square requires unique-ish variation name; we can keep it simple
  const variationName = "Regular";

  const itemObjectId = p.square_item_id ? p.square_item_id : `#item_${p.id}`;
  const variationObjectId = p.square_variation_id
    ? p.square_variation_id
    : `#var_${p.id}`;

  const objects: any[] = [
    {
      type: "ITEM",
      id: itemObjectId,
      version: p.square_item_id ? undefined : undefined, // omit version; Square will handle create vs upsert via batch-upsert
      item_data: {
        name: itemName,
        description: itemDesc || undefined,
        variations: [
          {
            type: "ITEM_VARIATION",
            id: variationObjectId,
            item_variation_data: {
              name: variationName,
              sku: p.sku || undefined,
              upc: p.barcode || undefined, // Square supports upc on variation
              price_money: {
                amount: toCents(Number(p.price)),
                currency,
              },
              track_inventory: true,
            },
          },
        ],
      },
    },
  ];

  const idempotency_key = `supabase_products_upsert_${p.id}_${Date.now()}`;

  const body = {
    idempotency_key,
    batches: [{ objects }],
  };

  const result = await squareFetch("/catalog/batch-upsert", {
    method: "POST",
    body: JSON.stringify(body),
  });

  // If we used temporary IDs (#item_...), Square returns id_mappings
  let newItemId = p.square_item_id;
  let newVarId = p.square_variation_id;

  const mappings: Array<{ client_object_id: string; object_id: string }> =
    result?.id_mappings || [];

  for (const m of mappings) {
    if (m.client_object_id === `#item_${p.id}`) newItemId = m.object_id;
    if (m.client_object_id === `#var_${p.id}`) newVarId = m.object_id;
  }

  // If we updated existing objects, they might not appear in id_mappings — keep existing IDs.
  return {
    skipped: false,
    square_item_id: newItemId!,
    square_variation_id: newVarId!,
  };
}

/**
 * Attempts to create a Square CatalogImage using a URL.
 * Some Square accounts/regions may reject URL-based images (requires upload).
 * We handle failures gracefully.
 */
async function upsertSquareImageIfPossible(p: ProductRow, squareItemId: string) {
  if (!p.image_url) return { image_id: p.square_image_id ?? null, didTry: false };

  // If already have an image id, skip for now (we can improve later to update image)
  if (p.square_image_id) return { image_id: p.square_image_id, didTry: false };

  const idempotency_key = `supabase_products_image_${p.id}_${Date.now()}`;

  try {
    const result = await squareFetch("/catalog/images", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key,
        image: {
          type: "IMAGE",
          id: `#img_${p.id}`,
          image_data: {
            name: p.name || `Product ${p.id}`,
            url: p.image_url, // URL-based image creation (may be rejected on some accounts)
          },
        },
      }),
    });

    // In some responses, created image object is in "image"
    const imageObj = result?.image;
    const imageId = imageObj?.id || null;

    if (!imageId) return { image_id: null, didTry: true };

    // Attach image to ITEM
    await squareFetch("/catalog/batch-upsert", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `attach_img_${p.id}_${Date.now()}`,
        batches: [
          {
            objects: [
              {
                type: "ITEM",
                id: squareItemId,
                item_data: {
                  // Provide only fields we need to update
                  image_ids: [imageId],
                },
              },
            ],
          },
        ],
      }),
    });

    return { image_id: imageId, didTry: true };
  } catch {
    // If Square rejects URL images, we just skip images for now.
    return { image_id: null, didTry: true };
  }
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

  const results: Array<any> = [];
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of products) {
    try {
      const up = await upsertSquareCatalogObject(p);

      if (up.skipped) {
        skipped++;
        results.push({ id: p.id, status: "skipped", reason: up.reason });
        continue;
      }

      // Try image (best-effort)
      const squareItemId = up.square_item_id;
      const img = squareItemId ? await upsertSquareImageIfPossible(p, squareItemId) : null;
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
    } catch (e: any) {
      failed++;
      results.push({ id: p.id, status: "failed", error: e?.message || "error" });
    }
  }

  return NextResponse.json({
    ok: true,
    total: products.length,
    synced,
    skipped,
    failed,
    note:
      "If images don't appear, your Square account may not allow URL-based image creation. We can switch to upload-based images next.",
    results,
  });
}
