import { NextResponse } from "next/server";
import { uploadProductImageToR2 } from "@/lib/r2-upload";
import { createClient } from "@/utils/supabase/server";

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

type BarnDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const parseBarnDay = (formData: FormData): BarnDay | null => {
  const raw = String(formData.get("barn_burner_day") ?? "").trim();
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 7) return null;
  return n as BarnDay;
};

const barnBurnerPriceForDay = (day: BarnDay) => 45 - 5 * day; // 1->40 ... 7->10
const barnBurnerSubcategoryForDay = (day: BarnDay) => `day-${day}`;

function utcDateString(d = new Date()) {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const getOptionalMoney = (formData: FormData, key: string): number | null => {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : null;
};


const validateProductInputs = ({
  name,
  description,
  categories,
  quantityValue,
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
  condition: string;
  colors: string[];
  images: File[];
  price: number | null;
  isBarnBurner: boolean;
}) => {
  if (!name || !description || !quantityValue || !condition) {
    return "Name, description, quantity, and condition are required.";
  }

  // ✅ categories required (now array)
  if (!categories || categories.length === 0) {
    return "At least one category is required.";
  }

  // ✅ if barn burner, subcategory must be present (day-x)
  if (isBarnBurner && (!subcategories || subcategories.length === 0)) {
    return "Barn burner requires a start day (subcategory).";
  }

  if (!colors || colors.length === 0) {
    return "At least one color is required.";
  }

  if (!images || images.length === 0) {
    return "At least one product image is required.";
  }

  const quantity = Number(quantityValue);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return "Quantity must be a whole number.";
  }

  if (!isBarnBurner && (price === null || price < 0)) {
    return "Price is required.";
  }

  return null;
};

const uploadImagesToR2 = async (images: File[]) => {
  const uploads = await Promise.all(images.map((img) => uploadProductImageToR2(img)));
  return uploads.map((u) => u.publicUrl);
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

export const POST = async (request: Request) => {
  try {
    const { accessToken, userId } = await requireAdminAndToken();
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const condition = String(formData.get("condition") ?? "").trim();

    // ✅ NEW: arrays
    const categories = getMultiTextArray(formData, "category", "categories");
    const subcategories = getMultiTextArray(formData, "subcategory", "subcategories");

    const room_tags = getTextArray(formData, "room_tags");
    const collections = getTextArray(formData, "collections");
    const colors = getTextArray(formData, "colors");

    const height = getOptionalNumber(formData, "height");
    const width = getOptionalNumber(formData, "width");
    const depth = getOptionalNumber(formData, "depth");

    const isBarnBurner = getBoolean(formData, "is_barn_burner");
    const isOversized = getBoolean(formData, "is_oversized");
    const isMonthlyPriceDrop = getBoolean(formData, "is_monthly_price_drop");

    // optional: allow admin to override monthly drop amount, else default to 10 in DB
    const monthlyDropAmount = getOptionalMoney(formData, "monthly_drop_amount");

    // prevent mixing price-drop systems
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

    const price = isBarnBurner
      ? barnBurnerPriceForDay(barnDay as BarnDay)
      : getRequiredNumber(formData, "price");

    const images = parseImages(formData);

    // ✅ Enforce categories/subcategories for barn burner (server-side)
    const enforcedCategories = isBarnBurner ? ["barn-burner"] : categories;
    const enforcedSubcategories = isBarnBurner
      ? [barnBurnerSubcategoryForDay(barnDay as BarnDay)]
      : subcategories;

    const validationError = validateProductInputs({
      name,
      description,
      categories: enforcedCategories,
      subcategories: enforcedSubcategories,
      quantityValue,
      condition,
      colors,
      images,
      price,
      isBarnBurner,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const quantity = Number(quantityValue);
    const imageUrls = await uploadImagesToR2(images);
    const tableName = getProductsTableName();

    let barn_burner_started_at: string | null = null;
    let barn_burner_day: number | null = null;
    let barn_burner_last_tick: string | null = null;

    if (isBarnBurner) {
      const now = new Date();
      barn_burner_started_at = now.toISOString();
      barn_burner_day = barnDay as BarnDay;
      barn_burner_last_tick = now.toISOString().slice(0, 10);
    }

    let monthly_drop_started_at: string | null = null;
    let monthly_drop_last_tick: string | null = null; // will write as date string; Postgres will cast to date
    let monthly_drop_amount: number | null = null;

    if (isMonthlyPriceDrop) {
      const now = new Date();
      monthly_drop_started_at = now.toISOString();

      // mark “this month already handled” so your cron doesn't drop immediately on the start month
      monthly_drop_last_tick = utcDateString(now);

      monthly_drop_amount = monthlyDropAmount ?? 10;
    }

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
      quantity,
      price,

      image_url: imageUrls[0],
      image_urls: imageUrls,

      created_by: userId,
      created_at: new Date().toISOString(),

      is_barn_burner: isBarnBurner,
      barn_burner_started_at,
      barn_burner_day,
      barn_burner_last_tick,

      is_oversized: isOversized,

      is_monthly_price_drop: isMonthlyPriceDrop,
      monthly_drop_started_at,
      monthly_drop_last_tick,
    };
    if (isMonthlyPriceDrop) {
      productPayload.monthly_drop_amount = monthlyDropAmount ?? 10;
    }

    const data = await supabaseRestInsert(tableName, accessToken, productPayload);

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
    const condition = String(formData.get("condition") ?? "").trim();

    // ✅ arrays
    const categories = getMultiTextArray(formData, "category", "categories");
    const subcategories = getMultiTextArray(formData, "subcategory", "subcategories");

    const room_tags = getTextArray(formData, "room_tags");
    const collections = getTextArray(formData, "collections");
    const colors = getTextArray(formData, "colors");

    const height = getOptionalNumber(formData, "height");
    const width = getOptionalNumber(formData, "width");
    const depth = getOptionalNumber(formData, "depth");

    const isBarnBurner = getBoolean(formData, "is_barn_burner");

    const barnDay = isBarnBurner ? parseBarnDay(formData) : null;
    if (isBarnBurner && !barnDay) {
      return NextResponse.json({ error: "Barn burner day must be an integer from 1 to 7." }, { status: 400 });
    }

    const isOversized = getBoolean(formData, "is_oversized");
    const isMonthlyPriceDrop = getBoolean(formData, "is_monthly_price_drop");
    const monthlyDropAmount = getOptionalMoney(formData, "monthly_drop_amount");

    if (isBarnBurner && isMonthlyPriceDrop) {
      return NextResponse.json(
        { error: "Item cannot be both Barn Burner and Monthly Price Drop." },
        { status: 400 }
      );
    }

    const price = isBarnBurner
      ? barnBurnerPriceForDay(barnDay as BarnDay)
      : getRequiredNumber(formData, "price");

    const images = parseImages(formData);

    // ✅ enforce barn burner values
    const enforcedCategories = isBarnBurner ? ["barn-burner"] : categories;
    const enforcedSubcategories = isBarnBurner
      ? [barnBurnerSubcategoryForDay(barnDay as BarnDay)]
      : subcategories;

    // PATCH validation (images optional, but rest required)
    if (!name || !description || !quantityValue || !condition) {
      return NextResponse.json(
        { error: "Name, description, quantity, and condition are required." },
        { status: 400 }
      );
    }
    if (!enforcedCategories || enforcedCategories.length === 0) {
      return NextResponse.json({ error: "At least one category is required." }, { status: 400 });
    }
    if (!colors || colors.length === 0) {
      return NextResponse.json({ error: "At least one color is required." }, { status: 400 });
    }
    const quantity = Number(quantityValue);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Quantity must be a whole number." }, { status: 400 });
    }
    if (!isBarnBurner && (price === null || price < 0)) {
      return NextResponse.json({ error: "Price is required." }, { status: 400 });
    }

    let barn_burner_started_at: string | null = null;
    let barn_burner_day: number | null = null;
    let barn_burner_last_tick: string | null = null;

    if (isBarnBurner) {
      const now = new Date();
      barn_burner_started_at = now.toISOString();
      barn_burner_day = barnDay as BarnDay;
      barn_burner_last_tick = now.toISOString().slice(0, 10);
    }

    let monthly_drop_started_at: string | null = null;
    let monthly_drop_last_tick: string | null = null;
    let monthly_drop_amount: number | null = null;

    if (isMonthlyPriceDrop) {
      const now = new Date();
      monthly_drop_started_at = now.toISOString();
      monthly_drop_last_tick = utcDateString(now);
      monthly_drop_amount = monthlyDropAmount ?? 10;
    } else {
      monthly_drop_started_at = null;
      monthly_drop_last_tick = null;
    }

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
      quantity,
      price,
      updated_at: new Date().toISOString(),

      is_barn_burner: isBarnBurner,
      barn_burner_started_at,
      barn_burner_day,
      barn_burner_last_tick,

      is_oversized: isOversized,

      is_monthly_price_drop: isMonthlyPriceDrop,
      monthly_drop_started_at,
      monthly_drop_last_tick,
    };

    if (isMonthlyPriceDrop) {
      productPayload.monthly_drop_amount = monthlyDropAmount ?? 10;
    }
    

    if (images.length > 0) {
      const imageUrls = await uploadImagesToR2(images);
      productPayload.image_url = imageUrls[0];
      productPayload.image_urls = imageUrls;

      const data = await supabaseRestUpdate(tableName, accessToken, productId, productPayload);

      await sendToCloudflareDatabase({ ...productPayload, supabase_id: productId });
      return NextResponse.json({ product: data, imageUrls }, { status: 200 });
    } else {
      const data = await supabaseRestUpdate(tableName, accessToken, productId, productPayload);

      await sendToCloudflareDatabase({ ...productPayload, supabase_id: productId });
      return NextResponse.json({ product: data, imageUrls: [] }, { status: 200 });
    }
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
        "id,name,price,category,subcategory,colors,condition,image_url,image_urls,created_at,updated_at,quantity,is_active," +
        "is_barn_burner,barn_burner_started_at,barn_burner_day,barn_burner_last_tick," +
        "is_oversized,is_monthly_price_drop,monthly_drop_started_at,monthly_drop_last_tick,monthly_drop_amount"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    // ✅ category/subcategory are arrays — avoid ilike on arrays.
    // We'll keep search on name only (safe).
    if (qRaw) {
      query = query.ilike("name", `%${qRaw}%`);
    }

    if (priceParam) {
      const n = Number(priceParam);
      if (!Number.isNaN(n)) query = query.eq("price", n);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Not signed in") ? 401 : message.includes("Admins only") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
