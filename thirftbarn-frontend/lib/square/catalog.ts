const SQUARE_API_BASE = "https://connect.squareup.com/v2";

export type ProductForSquare = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  square_item_id: string | null;
  square_variation_id: string | null;
  square_image_id: string | null;
};

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function toCents(price: number) {
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
    const msg = json?.errors?.[0]?.detail || json?.errors?.[0]?.code || `Square API error (${res.status})`;
    throw new Error(`${msg} :: ${path}`);
  }
  return json;
}

export async function upsertSquareCatalogObject(p: ProductForSquare) {
  const currency = process.env.SQUARE_CURRENCY || "CAD";

  if (!p.name || p.price == null) {
    return { skipped: true as const, reason: "missing name/price" as const };
  }

  const itemObjectId = p.square_item_id ? p.square_item_id : `#item_${p.id}`;
  const variationObjectId = p.square_variation_id ? p.square_variation_id : `#var_${p.id}`;

  const objects: any[] = [
    {
      type: "ITEM",
      id: itemObjectId,
      item_data: {
        name: p.name.trim(),
        description: (p.description || "").trim().slice(0, 4096) || undefined,
        variations: [
          {
            type: "ITEM_VARIATION",
            id: variationObjectId,
            item_variation_data: {
              name: "Regular",
              sku: p.sku || undefined,
              upc: p.barcode || undefined,
              price_money: { amount: toCents(Number(p.price)), currency },
              track_inventory: true,
            },
          },
        ],
      },
    },
  ];

  const result = await squareFetch("/catalog/batch-upsert", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: `tbf_upsert_${p.id}_${Date.now()}`,
      batches: [{ objects }],
    }),
  });

  let newItemId = p.square_item_id;
  let newVarId = p.square_variation_id;

  const mappings: Array<{ client_object_id: string; object_id: string }> = result?.id_mappings || [];
  for (const m of mappings) {
    if (m.client_object_id === `#item_${p.id}`) newItemId = m.object_id;
    if (m.client_object_id === `#var_${p.id}`) newVarId = m.object_id;
  }

  return { skipped: false as const, square_item_id: newItemId!, square_variation_id: newVarId! };
}

export async function upsertSquareImageIfPossible(p: ProductForSquare, squareItemId: string) {
  if (!p.image_url) return { image_id: p.square_image_id ?? null, didTry: false };
  if (p.square_image_id) return { image_id: p.square_image_id, didTry: false };

  try {
    const result = await squareFetch("/catalog/images", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `tbf_img_${p.id}_${Date.now()}`,
        image: {
          type: "IMAGE",
          id: `#img_${p.id}`,
          image_data: { name: p.name || `Product ${p.id}`, url: p.image_url },
        },
      }),
    });

    const imageId = result?.image?.id || null;
    if (!imageId) return { image_id: null, didTry: true };

    await squareFetch("/catalog/batch-upsert", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `tbf_attach_img_${p.id}_${Date.now()}`,
        batches: [
          { objects: [{ type: "ITEM", id: squareItemId, item_data: { image_ids: [imageId] } }] },
        ],
      }),
    });

    return { image_id: imageId, didTry: true };
  } catch {
    return { image_id: null, didTry: true };
  }
}
