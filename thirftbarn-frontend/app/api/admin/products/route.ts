import { NextResponse } from "next/server";
import { deleteProductImagesFromR2, uploadProductImageToR2 } from "@/lib/r2-upload";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { upsertSquareCatalogObject, upsertSquareImageIfPossible } from "@/lib/square/catalog";
import { setSquareInStockCount } from "@/lib/square/inventory";
import { normalizeQuantity, toStoredQuantity } from "@/lib/inventory";
import {
  formatEstateSaleName,
  getEstateSaleSlug,
  isEstateSaleCollection,
  isEstateSalePhotoCollection,
} from "@/lib/estate-sales";

const sendToCloudflareDatabase = async (payload: Record<string, unknown>) => {
  const endpoint = process.env.CLOUDFLARE_PRODUCTS_ENDPOINT;
  if (!endpoint) return;

  const token = process.env.CLOUDFLARE_PRODUCTS_TOKEN;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare DB sync failed: ${errorText}`);
  }
};

const parseImages = (formData: FormData) =>
  formData
    .getAll("images")
    .filter((entry) => entry instanceof File)
    .map((entry) => entry as File)
    .filter((entry) => entry.size > 0);

const parseOptionalImage = (formData: FormData, key: string) => {
  const entry = formData.get(key);
  if (!(entry instanceof File) || entry.size <= 0) return null;
  return entry;
};

const getTextArray = (formData: FormData, key: string) =>
  formData
    .getAll(key)
    .map((x) => String(x).trim())
    .filter(Boolean);

// ✅ Accept either repeated keys ("category") OR an alternate key ("categories")
// ✅ Also supports legacy single value (formData.get)
const getMultiTextArray = (formData: FormData, primaryKey: string, fallbackKey?: string) => {
  const fromPrimary = getTextArray(formData, primaryKey);
  if (fromPrimary.length > 0) return fromPrimary;

  if (fallbackKey) {
    const fromFallback = getTextArray(formData, fallbackKey);
    if (fromFallback.length > 0) return fromFallback;
  }

  const single = String(formData.get(primaryKey) ?? "").trim();
  return single ? [single] : [];
};

const getOptionalNumber = (formData: FormData, key: string): number | null => {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const getRequiredNumber = (formData: FormData, key: string): number | null => {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const getBoolean = (formData: FormData, key: string) => {
  const raw = String(formData.get(key) ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on" || raw === "yes";
};

const parseBarnDay = (formData: FormData): number | null => {
  const raw = String(formData.get("barn_burner_day") ?? "").trim();
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 7) return null;
  return n;
};

const validateProductInputs = ({
  name,
  description,
  categories,
  quantityValue,
  unlimitedQuantity,
  condition,
  colors,
  images,
  price,
  isBarnBurner,
  subcategories,
}: {
  name: string;
  description: string;
  categories: string[];
  subcategories: string[];
  quantityValue: string;
  unlimitedQuantity: boolean;
  condition: string;
  colors: string[];
  images: File[];
  price: number | null;
  isBarnBurner: boolean;
}) => {
  if (!name || !description || !condition) {
    return "Name, description, and condition are required.";
  }

  if (!categories || categories.length === 0) {
    return "At least one category is required.";
  }

  if (isBarnBurner && (!subcategories || subcategories.length === 0)) {
    return "Barn burner requires a start day (subcategory).";
  }

  if (!colors || colors.length === 0) {
    return "At least one color is required.";
  }

  if (!images || images.length === 0) {
    return "At least one product image is required.";
  }

  if (!unlimitedQuantity) {
    if (!quantityValue) {
      return "Quantity is required unless the item has unlimited quantity.";
    }

    const quantity = Number(quantityValue);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return "Quantity must be a whole number.";
    }
  }

  // ✅ price is required for ALL items now (including barn burner)
  if (price === null || price < 0) {
    return "Price is required.";
  }

  return null;
};

const parseQuantity = (quantityValue: string, unlimitedQuantity: boolean): number | null => {
  if (unlimitedQuantity) return null;

  const quantity = Number(quantityValue);
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("Quantity must be a whole number.");
  }

  return quantity;
};

const uploadImagesToR2 = async (images: File[]) => {
  const uploads = await Promise.all(images.map((img) => uploadProductImageToR2(img)));
  return uploads.map((u) => u.publicUrl);
};

const getProductImageUrls = (product: { image_url?: string | null; image_urls?: unknown }) => {
  const urls = new Set<string>();

  if (typeof product.image_url === "string" && product.image_url.trim()) {
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
};

const reorderImagesWithPrimaryFirst = (imageUrls: string[], primaryImageUrl: string | null) => {
  const uniqueUrls = Array.from(new Set(imageUrls.filter(Boolean)));
  if (!primaryImageUrl) return uniqueUrls;

  const remaining = uniqueUrls.filter((url) => url !== primaryImageUrl);
  return [primaryImageUrl, ...remaining];
};

const upsertEstateSaleMetadata = async (collections: string[], formData: FormData) => {
  const cleanedCollections = collections.filter((collection) => !isEstateSalePhotoCollection(collection));
  const estateCollection = cleanedCollections.find(isEstateSaleCollection);
  if (!estateCollection) return cleanedCollections;

  const estatePhoto = parseOptionalImage(formData, "estate_sale_image");
  const existingEstatePhoto = String(formData.get("existing_estate_sale_photo") ?? "").trim();
  const estateSlug = getEstateSaleSlug(estateCollection);
  const estateName = formatEstateSaleName(estateCollection);

  const estatePhotoUrl = estatePhoto
    ? (await uploadProductImageToR2(estatePhoto)).publicUrl
    : existingEstatePhoto;

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const payload: Record<string, unknown> = {
      slug: estateSlug,
      name: estateName,
      updated_at: new Date().toISOString(),
    };

    if (estatePhotoUrl) payload.photo_url = estatePhotoUrl;

    const { error } = await supabaseAdmin
      .from("estate_sales")
      .upsert(payload, { onConflict: "slug" });

    if (error) {
      console.error("upsertEstateSaleMetadata error:", error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown estate sale metadata error";
    console.error("upsertEstateSaleMetadata error:", message);
  }

  return cleanedCollections;
};

async function requireAdminAndToken() {
  const supabase = await createClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw new Error(sessionError.message);
  if (!session?.access_token) throw new Error("Not signed in.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("Not signed in.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError) throw new Error(profileError.message);
  if (!profile?.is_admin) throw new Error("Admins only.");

  return { accessToken: session.access_token, userId: user.id };
}

function getSupabaseUrlOrThrow() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) throw new Error("Missing Supabase URL.");
  return url;
}

function makeSku() {
  return `TB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getProductsTableName() {
  return process.env.SUPABASE_PRODUCTS_TABLE ?? "products";
}

async function supabaseRestInsert(tableName: string, accessToken: string, payload: Record<string, unknown>) {
  const supabaseUrl = getSupabaseUrlOrThrow();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");

  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase insert failed: ${errorText}`);
  }

  const data = (await response.json()) as Record<string, unknown>[];
  return data[0] ?? null;
}

async function supabaseRestUpdate(
  tableName: string,
  accessToken: string,
  productId: string,
  payload: Record<string, unknown>
) {
  const supabaseUrl = getSupabaseUrlOrThrow();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${tableName}?id=eq.${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase update failed: ${errorText}`);
  }

  const data = (await response.json()) as Record<string, unknown>[];
  return data[0] ?? null;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function toOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function syncProductToSquare(args: {
  accessToken: string;
  tableName: string;
  row: Record<string, unknown> | null;
  productId: string;
  name: string;
  description: string;
  price: number;
  quantity: number | null;
  fallbackImageUrl?: string | null;
}) {
  if (!args.row) return;

  const row = args.row;
  const up = await upsertSquareCatalogObject({
    id: args.productId,
    sku: toOptionalString(row.sku),
    barcode: toOptionalString(row.barcode),
    name: toOptionalString(row.name) ?? args.name,
    description: toOptionalString(row.description) ?? args.description,
    price: toOptionalNumber(row.price) ?? args.price,
    image_url: toOptionalString(row.image_url) ?? args.fallbackImageUrl ?? null,
    square_item_id: toOptionalString(row.square_item_id),
    square_variation_id: toOptionalString(row.square_variation_id),
    square_image_id: toOptionalString(row.square_image_id),
    track_inventory: args.quantity !== null,
  });

  if (up.skipped) return;

  let squareImageId = toOptionalString(row.square_image_id);

  try {
    const img = await upsertSquareImageIfPossible(
      {
        id: args.productId,
        sku: toOptionalString(row.sku),
        barcode: toOptionalString(row.barcode),
        name: toOptionalString(row.name) ?? args.name,
        description: toOptionalString(row.description) ?? args.description,
        price: toOptionalNumber(row.price) ?? args.price,
        image_url: toOptionalString(row.image_url) ?? args.fallbackImageUrl ?? null,
        square_item_id: up.square_item_id,
        square_variation_id: up.square_variation_id,
        square_image_id: squareImageId,
      },
      up.square_item_id
    );

    squareImageId = img.image_id ?? squareImageId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Auto Square image sync failed:", message);
  }

  await supabaseRestUpdate(args.tableName, args.accessToken, args.productId, {
    square_item_id: up.square_item_id,
    square_variation_id: up.square_variation_id,
    square_image_id: squareImageId,
  });

  if (args.quantity !== null) {
    await setSquareInStockCount({
      variationId: up.square_variation_id,
      newQty: args.quantity,
      idempotencyKey: `sync_${args.productId}_${Date.now()}`,
    });
  }
}

export const POST = async (request: Request) => {
  try {
    const { accessToken, userId } = await requireAdminAndToken();
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const unlimitedQuantity = getBoolean(formData, "unlimited_quantity");
    const condition = String(formData.get("condition") ?? "").trim();

    const categories = getMultiTextArray(formData, "category", "categories");
    const subcategories = getMultiTextArray(formData, "subcategory", "subcategories");

    const room_tags = getTextArray(formData, "room_tags");
    const collections = await upsertEstateSaleMetadata(getTextArray(formData, "collections"), formData);
    const colors = getTextArray(formData, "colors");

    const height = getOptionalNumber(formData, "height");
    const width = getOptionalNumber(formData, "width");
    const depth = getOptionalNumber(formData, "depth");

    const isBarnBurner = getBoolean(formData, "is_barn_burner");
    const isOversized = getBoolean(formData, "is_oversized");
    const isMonthlyPriceDrop = getBoolean(formData, "is_monthly_price_drop");

    if (isBarnBurner && isMonthlyPriceDrop) {
      return NextResponse.json(
        { error: "Item cannot be both Barn Burner and Monthly Price Drop." },
        { status: 400 }
      );
    }

    const barnDay = isBarnBurner ? parseBarnDay(formData) : null;
    if (isBarnBurner && !barnDay) {
      return NextResponse.json({ error: "Barn burner day must be an integer from 1 to 7." }, { status: 400 });
    }

    const price = getRequiredNumber(formData, "price");
    const images = parseImages(formData);

    const enforcedCategories = isBarnBurner ? ["barn-burner"] : categories;
    const enforcedSubcategories = isBarnBurner ? [`day-${barnDay}`] : subcategories;

    const validationError = validateProductInputs({
      name,
      description,
      categories: enforcedCategories,
      subcategories: enforcedSubcategories,
      quantityValue,
      unlimitedQuantity,
      condition,
      colors,
      images,
      price,
      isBarnBurner,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const quantity = parseQuantity(quantityValue, unlimitedQuantity);
    const storedQuantity = toStoredQuantity(quantity);
    const imageUrls = await uploadImagesToR2(images);
    const tableName = getProductsTableName();

    const nowIso = new Date().toISOString();

    // ✅ Let DB cron handle ticking; we just set the start markers.
    const barn_burner_started_at = isBarnBurner ? nowIso : null;
    const barn_burner_day = isBarnBurner ? barnDay : null;
    const barn_burner_last_tick = isBarnBurner ? null : null;

    const monthly_drop_started_at = isMonthlyPriceDrop ? nowIso : null;
    const monthly_drop_last_tick = isMonthlyPriceDrop ? null : null;

    const productPayload: Record<string, unknown> = {
      sku: makeSku(),
      name,
      description,

      category: enforcedCategories,
      subcategory: enforcedSubcategories,

      room_tags,
      collections,
      colors,
      condition,
      height,
      width,
      depth,
      quantity: storedQuantity,
      is_active: quantity === null ? true : quantity > 0,

      // ✅ two price columns: initial_price never changes; price is current and will be ticked by DB
      initial_price: price,
      price,

      image_url: imageUrls[0],
      image_urls: imageUrls,

      created_by: userId,
      created_at: nowIso,

      is_barn_burner: isBarnBurner,
      barn_burner_started_at,
      barn_burner_day,
      barn_burner_last_tick,

      is_oversized: isOversized,

      is_monthly_price_drop: isMonthlyPriceDrop,
      monthly_drop_started_at,
      monthly_drop_last_tick,
    };

    const data = await supabaseRestInsert(tableName, accessToken, productPayload);

    // AUTO-SYNC to Square (optional toggle)
    const autoSquare = (process.env.AUTO_SQUARE_SYNC || "true").toLowerCase() !== "false";

    if (autoSquare) {
      try {
        await syncProductToSquare({
          accessToken,
          tableName,
          row: data as Record<string, unknown> | null,
          productId: String((data as Record<string, unknown> | null)?.id ?? ""),
          name,
          description,
          price: price ?? 0,
          quantity,
          fallbackImageUrl: imageUrls[0] ?? null,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Auto Square sync (create) failed:", message);
        // don't fail product creation
      }
    }

    await sendToCloudflareDatabase({
      ...productPayload,
      supabase_id: data?.id,
    });

    return NextResponse.json({ product: data, imageUrls }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not signed in") ? 401 : message.includes("Admins only") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};

export const PATCH = async (request: Request) => {
  try {
    const { accessToken } = await requireAdminAndToken();
    const formData = await request.formData();

    const productId = String(formData.get("productId") ?? "").trim();
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required for updates." }, { status: 400 });
    }

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const unlimitedQuantity = getBoolean(formData, "unlimited_quantity");
    const condition = String(formData.get("condition") ?? "").trim();

    const categories = getMultiTextArray(formData, "category", "categories");
    const subcategories = getMultiTextArray(formData, "subcategory", "subcategories");

    const room_tags = getTextArray(formData, "room_tags");
    const collections = await upsertEstateSaleMetadata(getTextArray(formData, "collections"), formData);
    const colors = getTextArray(formData, "colors");

    const height = getOptionalNumber(formData, "height");
    const width = getOptionalNumber(formData, "width");
    const depth = getOptionalNumber(formData, "depth");

    const isBarnBurner = getBoolean(formData, "is_barn_burner");
    const isOversized = getBoolean(formData, "is_oversized");
    const isMonthlyPriceDrop = getBoolean(formData, "is_monthly_price_drop");

    if (isBarnBurner && isMonthlyPriceDrop) {
      return NextResponse.json(
        { error: "Item cannot be both Barn Burner and Monthly Price Drop." },
        { status: 400 }
      );
    }

    const barnDay = isBarnBurner ? parseBarnDay(formData) : null;
    if (isBarnBurner && !barnDay) {
      return NextResponse.json({ error: "Barn burner day must be an integer from 1 to 7." }, { status: 400 });
    }

    const price = getRequiredNumber(formData, "price");
    const images = parseImages(formData);
    const keepImageUrls = getTextArray(formData, "keep_image_urls");
    const manageExistingImages = getBoolean(formData, "manage_existing_images");
    const requestedPrimaryImage = String(formData.get("primary_image") ?? "").trim();

    const enforcedCategories = isBarnBurner ? ["barn-burner"] : categories;
    const enforcedSubcategories = isBarnBurner ? [`day-${barnDay}`] : subcategories;

    // PATCH validation (images optional)
    if (!name || !description || !condition) {
      return NextResponse.json(
        { error: "Name, description, and condition are required." },
        { status: 400 }
      );
    }
    if (!enforcedCategories || enforcedCategories.length === 0) {
      return NextResponse.json({ error: "At least one category is required." }, { status: 400 });
    }
    if (!colors || colors.length === 0) {
      return NextResponse.json({ error: "At least one color is required." }, { status: 400 });
    }
    if (!unlimitedQuantity) {
      if (!quantityValue) {
        return NextResponse.json(
          { error: "Quantity is required unless the item has unlimited quantity." },
          { status: 400 }
        );
      }

      const parsedQuantity = Number(quantityValue);
      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
        return NextResponse.json({ error: "Quantity must be a whole number." }, { status: 400 });
      }
    }
    if (price === null || price < 0) {
      return NextResponse.json({ error: "Price is required." }, { status: 400 });
    }
    const quantity = parseQuantity(quantityValue, unlimitedQuantity);
    const storedQuantity = toStoredQuantity(quantity);

    const nowIso = new Date().toISOString();

    // When toggling programs on, reset last_tick so DB cron can handle next tick cleanly
    const barn_burner_started_at = isBarnBurner ? nowIso : null;
    const barn_burner_day = isBarnBurner ? barnDay : null;
    const barn_burner_last_tick = isBarnBurner ? null : null;

    const monthly_drop_started_at = isMonthlyPriceDrop ? nowIso : null;
    const monthly_drop_last_tick = isMonthlyPriceDrop ? null : null;

    const tableName = getProductsTableName();

    const productPayload: Record<string, unknown> = {
      name,
      description,
      category: enforcedCategories,
      subcategory: enforcedSubcategories,

      room_tags,
      collections,
      colors,
      condition,
      height,
      width,
      depth,
      quantity: storedQuantity,
      is_active: quantity === null ? true : quantity > 0,

      // ✅ price can be edited manually; initial_price is NOT touched on edits
      price,

      // keep updated_at if you still have the column
      updated_at: nowIso,

      is_barn_burner: isBarnBurner,
      barn_burner_started_at,
      barn_burner_day,
      barn_burner_last_tick,

      is_oversized: isOversized,

      is_monthly_price_drop: isMonthlyPriceDrop,
      monthly_drop_started_at,
      monthly_drop_last_tick,
    };

    const supabaseAdmin = createSupabaseAdmin();
    const { data: existingProduct, error: existingProductError } = await supabaseAdmin
      .from(tableName)
      .select("image_url,image_urls")
      .eq("id", productId)
      .maybeSingle();

    if (existingProductError) {
      return NextResponse.json({ error: existingProductError.message }, { status: 500 });
    }

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const existingImageUrls = getProductImageUrls(existingProduct);
    const preservedExistingImages = manageExistingImages
      ? keepImageUrls.filter((url) => existingImageUrls.includes(url))
      : existingImageUrls;
    const uploadedImageUrls = images.length > 0 ? await uploadImagesToR2(images) : [];
    const combinedImageUrls = Array.from(new Set([...preservedExistingImages, ...uploadedImageUrls]));

    if (combinedImageUrls.length === 0) {
      return NextResponse.json({ error: "At least one product image is required." }, { status: 400 });
    }

    let primaryImageUrl: string | null = null;

    if (requestedPrimaryImage.startsWith("existing:")) {
      const candidate = requestedPrimaryImage.slice("existing:".length);
      if (combinedImageUrls.includes(candidate)) {
        primaryImageUrl = candidate;
      }
    } else if (requestedPrimaryImage.startsWith("new:")) {
      const rawIndex = Number(requestedPrimaryImage.slice("new:".length));
      if (Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < uploadedImageUrls.length) {
        primaryImageUrl = uploadedImageUrls[rawIndex] ?? null;
      }
    }

    if (!primaryImageUrl && existingProduct.image_url && combinedImageUrls.includes(existingProduct.image_url)) {
      primaryImageUrl = existingProduct.image_url;
    }

    primaryImageUrl = primaryImageUrl ?? combinedImageUrls[0] ?? null;
    const orderedImageUrls = reorderImagesWithPrimaryFirst(combinedImageUrls, primaryImageUrl);

    productPayload.image_url = primaryImageUrl;
    productPayload.image_urls = orderedImageUrls;

    const data = await supabaseRestUpdate(tableName, accessToken, productId, productPayload);
    const autoSquare = (process.env.AUTO_SQUARE_SYNC || "true").toLowerCase() !== "false";

    if (autoSquare) {
      try {
        await syncProductToSquare({
          accessToken,
          tableName,
          row: data as Record<string, unknown> | null,
          productId,
          name,
          description,
          price: price ?? 0,
          quantity,
          fallbackImageUrl: productPayload.image_url as string | null | undefined,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Auto Square sync (update) failed:", message);
      }
    }

    const removedImageUrls = existingImageUrls.filter((url) => !orderedImageUrls.includes(url));
    if (removedImageUrls.length > 0) {
      try {
        await deleteProductImagesFromR2(removedImageUrls);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Product image cleanup failed:", message);
      }
    }

    await sendToCloudflareDatabase({ ...productPayload, supabase_id: productId });

    return NextResponse.json({ product: data, imageUrls: orderedImageUrls }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not signed in") ? 401 : message.includes("Admins only") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};

export const GET = async (request: Request) => {
  try {
    await requireAdminAndToken();

    const supabase = await createClient();
    const tableName = getProductsTableName();

    const url = new URL(request.url);
    const qRaw = (url.searchParams.get("q") ?? "").trim();
    const priceParam = (url.searchParams.get("price") ?? "").trim();

    let query = supabase
      .from(tableName)
      .select(
        "id,name,initial_price,price,category,subcategory,collections,colors,condition,image_url,image_urls,created_at,updated_at,quantity,is_active," +
          "is_barn_burner,barn_burner_started_at,barn_burner_day,barn_burner_last_tick," +
          "is_oversized,is_monthly_price_drop,monthly_drop_started_at,monthly_drop_last_tick"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (qRaw) {
      query = query.ilike("name", `%${qRaw}%`);
    }

    if (priceParam) {
      const n = Number(priceParam);
      if (!Number.isNaN(n)) query = query.eq("price", n);
    }

    const { data, error } = await query;
    if (error) {
      const msg = error.message.toLowerCase();
      const schemaMismatch = msg.includes("column") || msg.includes("does not exist");

      if (!schemaMismatch) {
        throw new Error(error.message);
      }

      let fallbackQuery = supabase
        .from(tableName)
        .select("id,name,price,category,collections,colors,image_url,image_urls")
        .limit(500);

      if (qRaw) {
        fallbackQuery = fallbackQuery.ilike("name", `%${qRaw}%`);
      }

      if (priceParam) {
        const n = Number(priceParam);
        if (!Number.isNaN(n)) fallbackQuery = fallbackQuery.eq("price", n);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) throw new Error(fallbackError.message);

      return NextResponse.json(fallbackData ?? [], { status: 200 });
    }

    return NextResponse.json(
      (data ?? []).map((product: any) => ({
        ...product,
        quantity: normalizeQuantity(product.quantity),
      })),
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not signed in") ? 401 : message.includes("Admins only") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
