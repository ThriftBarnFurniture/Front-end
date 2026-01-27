import { createClient } from "@/utils/supabase/server";

export type Product = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  price: number | string; // Supabase numeric often comes back as string
  colors: string[];
  category: string[];
  subcategory: string[];     
  room_tags: string[];            
  collections: string[]; 
  condition: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  quantity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  image_urls: string[] | null;
  image_url: string | null;
};

export async function getShopProducts() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,sku,barcode,name,description,price,category,condition,height,width,depth,quantity,is_active,created_at,updated_at,created_by,image_urls,image_url, subcategory, room_tags, collections"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

// Helpers
export function getPrimaryImage(p: Pick<Product, "image_urls" | "image_url">) {
  if (p.image_urls && p.image_urls.length > 0) return p.image_urls[0];
  if (p.image_url) return p.image_url;
  return null;
}

export function formatPrice(price: Product["price"]) {
  const n = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

export async function getProductById(id: string) {
  if (!id) return null; // ← prevents UUID error
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,sku,barcode,name,description,price,category,subcategory,colors,collections,room_tags,condition,height,width,depth,quantity,is_active,created_at,updated_at,created_by,image_urls,image_url"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Product | null;
}

export function getAllImages(p: Pick<Product, "image_urls" | "image_url">) {
  const arr = (p.image_urls ?? []).filter(Boolean);
  if (arr.length > 0) return arr;
  return p.image_url ? [p.image_url] : [];
}