// lib/orders.ts
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type CartItemInput = { productId: string; quantity: number };

export type OrderItem = {
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  name: string;
};

export function toCents(priceDollars: number) {
  return Math.round(Number(priceDollars) * 100);
}

export function makeOrderNumber() {
  // Example: TB-20260109-8F3K2A
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TB-${y}${m}${day}-${rand}`;
}

export async function buildValidatedOrderItems(items: CartItemInput[]) {
  const supabaseAdmin = createSupabaseAdmin();

  const wanted = items
    .map((it) => ({
      productId: String(it.productId),
      quantity: Math.max(1, Math.floor(Number(it.quantity || 1))),
    }))
    .slice(0, 50);

  const ids = [...new Set(wanted.map((w) => w.productId))];

  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id,name,price,quantity,is_active")
    .in("id", ids);

  if (error) throw new Error(error.message);
  if (!products?.length) throw new Error("No products found for checkout.");

  const productById = new Map(products.map((p) => [p.id, p]));

  const orderItems: OrderItem[] = [];
  for (const w of wanted) {
    const p = productById.get(w.productId);
    if (!p) throw new Error(`Invalid product in cart: ${w.productId}`);
    if (!p.is_active) throw new Error(`Product is not active: ${p.name}`);
    if (p.quantity < w.quantity) throw new Error(`Not enough stock for: ${p.name}`);

    orderItems.push({
      product_id: p.id,
      quantity: w.quantity,
      unit_price_cents: toCents(Number(p.price)),
      name: p.name,
    });
  }

  const subtotal = orderItems.reduce((sum, it) => sum + it.unit_price_cents * it.quantity, 0);

  return { orderItems, subtotal_cents: subtotal };
}
