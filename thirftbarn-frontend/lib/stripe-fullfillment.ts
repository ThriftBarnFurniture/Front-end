import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { setSquareInStockCount } from "@/lib/square/inventory";
import { normalizeQuantity } from "@/lib/inventory";

import { isPaymentSettled, normalizeCheckoutItems, readOrderItemSnapshot, validatePaymentSnapshot } from "@/lib/checkout-validation";
type SupabaseAdminClient = ReturnType<typeof createSupabaseAdmin>;

type OrderDbRow = {
  order_id: string;
  order_number: string | null;
  status: string | null;
  purchase_date: string | null;
  subtotal: number | null;
  tax: number | null;
  shipping_cost: number | null;
  promo_code: string | null;
  promo_discount: number | null;
  total: number | null;
  currency: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  shipping_method: string | null;
  payment_id: string | null;
  stripe_session_id: string | null;
  stripe_email: string | null;
  items: unknown;
};

type OrderDbItem = {
  product_id?: string | null;
  productId?: string | null;
  id?: string | null;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  description?: string | null;
  quantity?: number | null;
  qty?: number | null;
  count?: number | null;
  unit_price_cents?: number | null;
  unitPriceCents?: number | null;
  unit_amount_cents?: number | null;
  amount_cents?: number | null;
  unitPrice?: number | null;
  unit_price?: number | null;
  price?: number | null;
  amount?: number | null;
};

export type FulfilledOrderItem = {
  productId: string | null;
  name: string;
  qty: number;
  unitPrice: number | null;
  lineTotal: number | null;
};

export type FulfilledOrderSummary = {
  duplicate: boolean;
  order_id: string;
  order_number: string | null;
  status: string | null;
  purchase_date: string | null;
  subtotal: number | null;
  tax: number | null;
  shipping_cost: number | null;
  promo_code: string | null;
  promo_discount: number | null;
  total: number | null;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  shipping_method: string | null;
  payment_id: string | null;
  stripe_session_id: string | null;
  stripe_email: string | null;
  items: FulfilledOrderItem[];
};

function toFiniteNumber(v: unknown): number | null {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim()
      ? Number(v)
      : Number.NaN;

  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeOrderItems(raw: unknown): FulfilledOrderItem[] {
  let source: unknown = raw;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }

  if (source && typeof source === "object" && !Array.isArray(source)) {
    const wrappedItems = (source as { items?: unknown }).items;
    if (Array.isArray(wrappedItems)) source = wrappedItems;
  }

  if (!Array.isArray(source)) return [];

  return source
    .map((entry): FulfilledOrderItem | null => {
      let item: unknown = entry;
      if (typeof item === "string") {
        try {
          item = JSON.parse(item);
        } catch {
          return null;
        }
      }
      if (!item || typeof item !== "object") return null;

      const src = item as OrderDbItem;
      const qtyRaw = Number(src.quantity ?? src.qty ?? src.count ?? 1);
      const qty = Math.max(1, Math.floor(Number.isFinite(qtyRaw) ? qtyRaw : 1));

      const cents = toFiniteNumber(
        src.unit_price_cents ??
          src.unitPriceCents ??
          src.unit_amount_cents ??
          src.amount_cents ??
          null
      );
      const unitPriceRaw = toFiniteNumber(
        src.unitPrice ?? src.unit_price ?? src.price ?? src.amount ?? null
      );
      const unitPrice = cents != null ? cents / 100 : unitPriceRaw;
      const lineTotal = unitPrice == null ? null : Number((unitPrice * qty).toFixed(2));

      const name =
        String(src.name ?? src.product_name ?? src.title ?? src.description ?? "").trim() || "Item";
      const productId = String(src.product_id ?? src.productId ?? src.id ?? "").trim() || null;

      return { productId, name, qty, unitPrice, lineTotal };
    })
    .filter((x): x is FulfilledOrderItem => Boolean(x));
}

function orderRowToSummary(row: OrderDbRow, duplicate: boolean): FulfilledOrderSummary {
  return {
    duplicate,
    order_id: row.order_id,
    order_number: row.order_number,
    status: row.status,
    purchase_date: row.purchase_date,
    subtotal: toFiniteNumber(row.subtotal),
    tax: toFiniteNumber(row.tax),
    shipping_cost: toFiniteNumber(row.shipping_cost),
    promo_code: row.promo_code,
    promo_discount: toFiniteNumber(row.promo_discount),
    total: toFiniteNumber(row.total),
    currency: String(row.currency ?? "cad").toUpperCase(),
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    shipping_address: row.shipping_address,
    shipping_method: row.shipping_method,
    payment_id: row.payment_id,
    stripe_session_id: row.stripe_session_id,
    stripe_email: row.stripe_email,
    items: normalizeOrderItems(row.items),
  };
}

async function getOrderRow(
  supabase: SupabaseAdminClient,
  opts: { orderId?: string | null; sessionId: string }
): Promise<OrderDbRow | null> {
  const baseSelect = [
    "order_id",
    "order_number",
    "status",
    "purchase_date",
    "subtotal",
    "tax",
    "shipping_cost",
    "promo_code",
    "promo_discount",
    "total",
    "currency",
    "customer_name",
    "customer_email",
    "customer_phone",
    "shipping_address",
    "shipping_method",
    "payment_id",
    "stripe_session_id",
    "stripe_email",
    "items",
  ].join(",");

  if (opts.orderId) {
    const { data, error } = await supabase
      .from("orders")
      .select(baseSelect)
      .eq("order_id", opts.orderId)
      .maybeSingle<OrderDbRow>();

    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const { data, error } = await supabase
    .from("orders")
    .select(baseSelect)
    .eq("stripe_session_id", opts.sessionId)
    .maybeSingle<OrderDbRow>();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function fulfillStripeCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<FulfilledOrderSummary> {
  const supabase = createSupabaseAdmin();

  if (!isPaymentSettled(session.payment_status, session.amount_total)) {
    throw new Error("Payment has not completed.");
  }
  const snapshot = await getOrderRow(supabase, {
    orderId: session.metadata?.order_id,
    sessionId: session.id,
  });
  if (!snapshot) throw new Error("Order not found for this payment.");
  if (snapshot.stripe_session_id && snapshot.stripe_session_id !== session.id) {
    throw new Error("Payment session does not match this order.");
  }
  const status = String(snapshot.status ?? "").toLowerCase();
  if (["paid", "fulfilled", "refunded", "chargeback"].includes(status)) {
    return orderRowToSummary(snapshot, true);
  }
  if (status !== "pending") throw new Error("Order is not awaiting payment.");

  // The order snapshot is the price contract made at checkout. Never rebuild
  // it from current catalog prices, which can change while Stripe is open.
  const items = readOrderItemSnapshot(snapshot.items);
  const wanted = normalizeCheckoutItems(items.map(item => ({ productId: item.product_id, quantity: item.quantity })));
  validatePaymentSnapshot({
    items, wanted, subtotal: snapshot.subtotal, total: snapshot.total,
    currency: snapshot.currency, amountTotal: session.amount_total, paymentCurrency: session.currency,
  });

  const ids = wanted.map((w) => w.productId);

  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id,name,price,image_url,quantity,is_active,square_variation_id")
    .in("id", ids);

  if (pErr) throw new Error(pErr.message);
  if (!products || !products.length) throw new Error("Products not found for order.");

  const pMap = new Map(products.map((p) => [p.id, p]));

  for (const w of wanted) {
    const p = pMap.get(w.productId);
    if (!p) throw new Error("Missing product in webhook validation.");
    if (!p.is_active) throw new Error(`Inactive product purchased: ${p.name}`);
    const quantity = normalizeQuantity(p.quantity);
    if (typeof quantity === "number" && quantity < w.quantity) {
      throw new Error(`Oversell detected for: ${p.name}`);
    }
  }

  const amountTotalCents = session.amount_total ?? 0;
  const currency = session.currency ?? "cad";

  const stripeEmail =
    session.customer_details?.email ?? (session.customer_email as string | null) ?? null;
  const customerEmail =
    typeof session.metadata?.customer_email === "string" ? session.metadata.customer_email : null;
  const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

  const updatePayload: Record<string, unknown> = {
    stripe_session_id: session.id,
    stripe_email: stripeEmail,
    // Preserve items, subtotal, tax, shipping and discounts from checkout.
    total: amountTotalCents / 100,
    amount_total_cents: amountTotalCents,
    currency,
    payment_method: "stripe",
    payment_id: paymentId,
    status: "paid",
    purchase_date: new Date().toISOString(),
  };

  if (customerEmail) {
    updatePayload.customer_email = customerEmail;
  }

  const updateQuery = supabase.from("orders").update(updatePayload)
    .eq("order_id", snapshot.order_id).eq("status", "pending");

  const { data: updated, error: updErr } = await updateQuery.select("order_id").maybeSingle();
  if (updErr) throw new Error(updErr.message);

  if (!updated?.order_id) {
    const row = await getOrderRow(supabase, { orderId: snapshot.order_id, sessionId: session.id });
    if (row && ["paid", "fulfilled", "refunded", "chargeback"].includes(String(row.status))) {
      return orderRowToSummary(row, true);
    }
    throw new Error("Order confirmation is not yet available.");
  }

  const orderId = updated.order_id as string;

  for (const w of wanted) {
    const p = pMap.get(w.productId)!;
    const quantity = normalizeQuantity(p.quantity);

    if (typeof quantity !== "number") {
      continue;
    }

    const { data: updatedProd, error: prodErr } = await supabase
      .from("products")
      .update({
        quantity: Math.max(0, quantity - w.quantity),
        updated_at: new Date().toISOString(),
        is_active: quantity - w.quantity > 0,
      })
      .eq("id", w.productId)
      .select("quantity,square_variation_id")
      .single();

    if (prodErr) throw new Error(prodErr.message);

    try {
      const variationId = updatedProd?.square_variation_id;
      const finalQty = Number(updatedProd?.quantity ?? 0);

      if (variationId) {
        await setSquareInStockCount({
          variationId,
          newQty: finalQty,
          idempotencyKey: `stripe_${session.id}_prod_${w.productId}`,
        });
      }
    } catch (sqErr: unknown) {
      const message = sqErr instanceof Error ? sqErr.message : String(sqErr);
      console.error("Square inventory sync failed:", message);
    }
  }

  const row = await getOrderRow(supabase, { orderId, sessionId: session.id });
  if (row) return orderRowToSummary(row, false);

  throw new Error("Confirmed order could not be loaded.");
}
