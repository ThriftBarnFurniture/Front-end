"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export async function createProduct(formData: FormData) {
  const { supabase } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price_cents = Number(formData.get("price_cents") ?? 0);
  const currency = String(formData.get("currency") ?? "cad").toLowerCase();
  const image_url = String(formData.get("image_url") ?? "").trim() || null;

  await supabase.from("products").insert({
    name,
    description,
    price_cents,
    currency,
    image_url,
    is_active: true,
  });

  revalidatePath("/shop");
  revalidatePath("/admin/products");
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price_cents = Number(formData.get("price_cents") ?? 0);
  const currency = String(formData.get("currency") ?? "cad").toLowerCase();
  const image_url = String(formData.get("image_url") ?? "").trim() || null;
  const is_active = String(formData.get("is_active")) === "true";

  await supabase
    .from("products")
    .update({ name, description, price_cents, currency, image_url, is_active })
    .eq("id", id);

  revalidatePath("/shop");
  revalidatePath("/admin/products");
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  await supabase.from("products").delete().eq("id", id);

  revalidatePath("/shop");
  revalidatePath("/admin/products");
}
