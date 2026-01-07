import { NextResponse } from "next/server";
import { uploadProductImageToR2 } from "@/lib/r2-upload";

const sendToCloudflareDatabase = async (payload: Record<string, unknown>) => {
  const endpoint = process.env.CLOUDFLARE_PRODUCTS_ENDPOINT;
  if (!endpoint) {
    return;
  }

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

const MAX_IMAGE_COUNT = 5;

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

    return { supabaseUrl, supabaseServiceKey };
};

const insertSupabaseProduct = async (
  tableName: string,
  payload: Record<string, unknown>
) => {
  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
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
};
const updateSupabaseProduct = async (
  tableName: string,
  productId: string,
  payload: Record<string, unknown>
) => {
  const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${tableName}?id=eq.${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
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
};

const parseImages = (formData: FormData) =>
  formData
    .getAll("images")
    .filter((entry) => entry instanceof File)
    .map((entry) => entry as File)
    .filter((entry) => entry.size > 0);

const validateProductInputs = ({
  name,
  description,
  category,
  priceValue,
  quantityValue,
}: {
  name: string;
  description: string;
  category: string;
  priceValue: string;
  quantityValue: string;
}) => {
  if (!name || !description || !priceValue || !category || !quantityValue) {
    return "Name, description, category, price, and quantity are required.";
  }

  const price = Number(priceValue);
  const quantity = Number(quantityValue);

  if (Number.isNaN(price) || price <= 0) {
    return "Price must be a positive number.";
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return "Quantity must be a whole number.";
  }

  return null;
};

const uploadImagesToR2 = async (images: File[]) => {
  if (images.length > MAX_IMAGE_COUNT) {
    throw new Error(`You can upload up to ${MAX_IMAGE_COUNT} images.`);
  }

  const uploads = await Promise.all(images.map((image) => uploadProductImageToR2(image)));
  return uploads.map((upload) => upload.publicUrl);
};

export const POST = async (request: Request) => {
  try {
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const priceValue = String(formData.get("price") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const images = parseImages(formData);

    const validationError = validateProductInputs({
      name,
      description,
      category,
      priceValue,
      quantityValue,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (images.length === 0) {
      return NextResponse.json({ error: "At least one product image is required." }, { status: 400 });
    }

    const price = Number(priceValue);
    const quantity = Number(quantityValue);

    const imageUrls = await uploadImagesToR2(images);
    const tableName = process.env.SUPABASE_PRODUCTS_TABLE ?? "products";

    const productPayload = {
      name,
      description,
      category,
      price,
      quantity,
      image_url: imageUrls[0],
      image_urls: imageUrls,
      created_at: new Date().toISOString(),
    };

    const data = await insertSupabaseProduct(tableName, productPayload);

    await sendToCloudflareDatabase({
      ...productPayload,
      supabase_id: data?.id,
    });

    return NextResponse.json({ product: data, imageUrls }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

export const PATCH = async (request: Request) => {
  try {
    const formData = await request.formData();

    const productId = String(formData.get("productId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const priceValue = String(formData.get("price") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const images = parseImages(formData);

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required for updates." }, { status: 400 });
    }

    const validationError = validateProductInputs({
      name,
      description,
      category,
      priceValue,
      quantityValue,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const price = Number(priceValue);
    const quantity = Number(quantityValue);

    const tableName = process.env.SUPABASE_PRODUCTS_TABLE ?? "products";
    const imageUrls = images.length > 0 ? await uploadImagesToR2(images) : [];

    const productPayload: Record<string, unknown> = {
      name,
      description,
      category,
      price,
      quantity,
      updated_at: new Date().toISOString(),
    };

    if (imageUrls.length > 0) {
      productPayload.image_url = imageUrls[0];
      productPayload.image_urls = imageUrls;
    }

    const data = await updateSupabaseProduct(tableName, productId, productPayload);

    await sendToCloudflareDatabase({
      ...productPayload,
      supabase_id: productId,
    });

    return NextResponse.json({ product: data, imageUrls }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
