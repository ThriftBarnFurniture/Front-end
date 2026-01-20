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

const getOptionalNumber = (formData: FormData, key: string): number | null => {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const validateProductInputs = ({
  name,
  description,
  category,
  quantityValue,
  condition,
  colors,
  images,
}: {
  name: string;
  description: string;
  category: string;
  quantityValue: string;
  condition: string;
  colors: string[];
  images: File[];
}) => {
  if (!name || !description || !category || !quantityValue || !condition) {
    return "Name, description, category, quantity, condition are required.";
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

  return null;
};

const uploadImagesToR2 = async (images: File[]) => {
  // ✅ No max
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

async function supabaseRestInsert(
  tableName: string,
  accessToken: string,
  payload: Record<string, unknown>
) {
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
    const category = String(formData.get("category") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const condition = String(formData.get("condition") ?? "").trim();

    const subcategoryRaw = String(formData.get("subcategory") ?? "").trim();
    const subcategory = subcategoryRaw ? subcategoryRaw : null;

    const room_tags = getTextArray(formData, "room_tags"); // [] if empty
    const collections = getTextArray(formData, "collections"); // [] if empty
    const colors = getTextArray(formData, "colors"); // required

    const height = getOptionalNumber(formData, "height");
    const width = getOptionalNumber(formData, "width");
    const depth = getOptionalNumber(formData, "depth");

    // Optional price (kept compatible with your existing schema)
    const price = getOptionalNumber(formData, "price");
    const priceValue = String(formData.get("price") ?? "").trim();

    const images = parseImages(formData);

    const validationError = validateProductInputs({
      name,
      description,
      category,
      quantityValue,
      condition,
      colors,
      images,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const quantity = Number(quantityValue);

    const imageUrls = await uploadImagesToR2(images);
    const tableName = getProductsTableName();

    const productPayload: Record<string, unknown> = {
      sku: makeSku(),
      name,
      description,
      category,
      subcategory, // null if empty
      room_tags, // [] if empty
      collections, // [] if empty
      colors, // required
      condition, // required
      height, // null if empty
      width,
      depth,
      quantity,
      price, // null if not provided
      image_url: imageUrls[0],
      image_urls: imageUrls,
      created_by: userId,
      created_at: new Date().toISOString(),
    };

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
    const category = String(formData.get("category") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const condition = String(formData.get("condition") ?? "").trim();

    const subcategoryRaw = String(formData.get("subcategory") ?? "").trim();
    const subcategory = subcategoryRaw ? subcategoryRaw : null;

    const room_tags = getTextArray(formData, "room_tags");
    const collections = getTextArray(formData, "collections");
    const colors = getTextArray(formData, "colors");

    const height = getOptionalNumber(formData, "height");
    const width = getOptionalNumber(formData, "width");
    const depth = getOptionalNumber(formData, "depth");

    const price = getOptionalNumber(formData, "price");

    const images = parseImages(formData);

    // For PATCH, images are optional — but other required fields remain required (per your form)
    const validationError = (() => {
      if (!name || !description || !category || !quantityValue || !condition) {
        return "Name, description, category, quantity, condition are required.";
      }
      const quantity = Number(quantityValue);
      if (!Number.isInteger(quantity) || quantity < 0) return "Quantity must be a whole number.";
      if (!colors || colors.length === 0) return "At least one color is required.";
      return null;
    })();

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const quantity = Number(quantityValue);
    const tableName = getProductsTableName();

    const productPayload: Record<string, unknown> = {
      name,
      description,
      category,
      subcategory,
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
    };

    // Only upload/replace images if new ones were provided
    if (images.length > 0) {
      const imageUrls = await uploadImagesToR2(images);
      productPayload.image_url = imageUrls[0];
      productPayload.image_urls = imageUrls;

      const data = await supabaseRestUpdate(tableName, accessToken, productId, productPayload);

      await sendToCloudflareDatabase({
        ...productPayload,
        supabase_id: productId,
      });

      return NextResponse.json({ product: data, imageUrls }, { status: 200 });
    } else {
      const data = await supabaseRestUpdate(tableName, accessToken, productId, productPayload);

      await sendToCloudflareDatabase({
        ...productPayload,
        supabase_id: productId,
      });

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
      .select("id,name,price,category,subcategory,colors,condition,image_url,image_urls,created_at,updated_at,quantity,is_active")
      .order("created_at", { ascending: false })
      .limit(500);

    if (qRaw) {
      query = query.or(`name.ilike.%${qRaw}%,category.ilike.%${qRaw}%`);
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
    const status =
      message.includes("Not signed in") ? 401 :
      message.includes("Admins only") ? 403 :
      500;

    return NextResponse.json({ error: message }, { status });
  }
};
