import { squareFetch } from "@/lib/square";

export type ProductForSquare = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string | null;
  description: string | null;
  price: number | null;
  track_inventory?: boolean;
  image_url: string | null;
  square_item_id: string | null;
  square_variation_id: string | null;
  square_image_id: string | null;
};

function toCents(price: number) {
  return Math.round(price * 100);
}

const SQUARE_IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

function getSquareAccessToken() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("Missing env var: SQUARE_ACCESS_TOKEN");
  return token;
}

function normalizeSquareImageMimeType(raw: string | null) {
  const mime = String(raw ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (mime === "image/jpg") return "image/jpeg";
  return mime;
}

function buildSquareImageFilename(imageUrl: string, mimeType: string) {
  const ext = SQUARE_IMAGE_MIME_EXT[mimeType] ?? "img";

  try {
    const pathname = new URL(imageUrl).pathname;
    const last = pathname.split("/").filter(Boolean).pop() ?? "";
    const stem = last.replace(/\.[^.]+$/u, "").trim() || "product-image";
    return `${stem}.${ext}`;
  } catch {
    return `product-image.${ext}`;
  }
}

async function squareMultipartFetch(path: string, init: RequestInit) {
  const token = getSquareAccessToken();
  const res = await fetch(`https://connect.squareup.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: { errors?: Array<{ detail?: string; code?: string }>; raw?: string } | null = null;
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

async function downloadImageForSquare(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to download product image for Square (${response.status}).`);
  }

  const mimeType = normalizeSquareImageMimeType(response.headers.get("content-type"));
  if (!SQUARE_IMAGE_MIME_EXT[mimeType]) {
    throw new Error(
      `Square image upload only supports JPG, PNG, or GIF. Source image type was ${mimeType || "unknown"}.`
    );
  }

  const bytes = await response.arrayBuffer();
  const fileName = buildSquareImageFilename(imageUrl, mimeType);
  const blob = new Blob([bytes], { type: mimeType });

  return { blob, fileName };
}

async function createOrUpdateSquareImage(args: {
  p: ProductForSquare;
  squareItemId: string;
  imageId?: string | null;
}) {
  if (!args.p.image_url) {
    return { image_id: args.p.square_image_id ?? null, didTry: false };
  }

  const { blob, fileName } = await downloadImageForSquare(args.p.image_url);
  const requestBody = {
    idempotency_key: `tbf_img_${args.p.id}_${Date.now()}`,
    object_id: args.squareItemId,
    is_primary: true,
    image: {
      ...(args.imageId ? {} : { id: `#img_${args.p.id}` }),
      type: "IMAGE",
      image_data: {
        name: args.p.name || `Product ${args.p.id}`,
      },
    },
  };

  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("request", JSON.stringify(requestBody));

  const path = args.imageId ? `/catalog/images/${args.imageId}` : "/catalog/images";
  const method = args.imageId ? "PUT" : "POST";
  const result = await squareMultipartFetch(path, {
    method,
    body: form,
  });

  return { image_id: result?.image?.id || args.imageId || null, didTry: true };
}

export async function upsertSquareCatalogObject(p: ProductForSquare) {
  const currency = process.env.SQUARE_CURRENCY || "CAD";

  if (!p.name || p.price == null) {
    return { skipped: true as const, reason: "missing name/price" as const };
  }

  const itemObjectId = p.square_item_id ? p.square_item_id : `#item_${p.id}`;
  const variationObjectId = p.square_variation_id ? p.square_variation_id : `#var_${p.id}`;

  const objects = [
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
              track_inventory: p.track_inventory ?? true,
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

  if (p.square_image_id) {
    try {
      return await createOrUpdateSquareImage({
        p,
        squareItemId,
        imageId: p.square_image_id,
      });
    } catch {
      // Fallback to create if the stored image ID is stale or unusable.
    }
  }

  return await createOrUpdateSquareImage({ p, squareItemId });
}
