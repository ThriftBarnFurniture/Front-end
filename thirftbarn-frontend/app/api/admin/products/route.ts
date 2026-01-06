import { NextResponse } from "next/server";

const getCloudflareImageUrl = async (file: File) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_IMAGES_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "Missing Cloudflare Images configuration. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGES_TOKEN."
    );
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare upload failed: ${errorText}`);
  }

  const payload = await response.json();
  const imageUrl = payload?.result?.variants?.[0] ?? payload?.result?.url;

  if (!imageUrl) {
    throw new Error("Cloudflare did not return an image URL.");
  }

  return imageUrl as string;
};

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

const insertSupabaseProduct = async (
  tableName: string,
  payload: Record<string, unknown>
) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

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

export const POST = async (request: Request) => {
  try {
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const priceValue = String(formData.get("price") ?? "").trim();
    const quantityValue = String(formData.get("quantity") ?? "").trim();
    const image = formData.get("image");

    if (!name || !description || !priceValue || !category || !quantityValue) {
      return NextResponse.json(
        { error: "Name, description, category, price, and quantity are required." },
        { status: 400 }
      );
    }

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Product image is required." }, { status: 400 });
    }

    const price = Number(priceValue);
    const quantity = Number(quantityValue);

    if (Number.isNaN(price) || price <= 0) {
      return NextResponse.json({ error: "Price must be a positive number." }, { status: 400 });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Quantity must be a whole number." }, { status: 400 });
    }

    const imageUrl = await getCloudflareImageUrl(image);
    const tableName = process.env.SUPABASE_PRODUCTS_TABLE ?? "products";

    const productPayload = {
      name,
      description,
      category,
      price,
      quantity,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    };

    const data = await insertSupabaseProduct(tableName, productPayload);

    await sendToCloudflareDatabase({
      ...productPayload,
      supabase_id: data?.id,
    });

    return NextResponse.json({ product: data, imageUrl }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
