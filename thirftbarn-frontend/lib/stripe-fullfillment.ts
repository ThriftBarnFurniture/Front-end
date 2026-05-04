import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { setSquareInStockCount } from "@/lib/square/inventory";
import { normalizeQuantity } from "@/lib/inventory";

type WantedItem = { productId: string; quantity: number };
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

function parsePackedCart(packed: string): WantedItem[] {
  if (!packed) return [];

  return packed
    .split(",")
    .map((pair) => {
      const [productId, qty] = pair.split(":");
      return {
        productId,
        quantity: Math.max(1, Math.floor(Number(qty || 1))),
      };
    })
    .filter((x) => x.productId);
}

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

function fallbackSummaryFromSession(args: {
  session: Stripe.Checkout.Session;
  duplicate: boolean;
  orderId?: string | null;
  items?: FulfilledOrderItem[];
}): FulfilledOrderSummary {
  const { session, duplicate } = args;

  const shippingCents = Number(session.metadata?.shipping_cost_cents ?? 0);
  const promoCents = Number(session.metadata?.promo_discount_cents ?? 0);
  const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

  const stripeEmail =
    session.customer_details?.email ?? (session.customer_email as string | null) ?? null;

  const customerName = String(session.metadata?.customer_name ?? "").trim() || null;
  const customerEmail = String(session.metadata?.customer_email ?? "").trim() || stripeEmail;
  const customerPhone = String(session.metadata?.customer_phone ?? "").trim() || null;

  return {
    duplicate,
    order_id: String(args.orderId ?? session.metadata?.order_id ?? "").trim() || session.id,
    order_number: String(session.metadata?.order_number ?? "").trim() || null,
    status: "paid",
    purchase_date: new Date().toISOString(),
    subtotal: null,
    tax: null,
    shipping_cost: Number.isFinite(shippingCents) ? Math.max(0, shippingCents / 100) : null,
    promo_code: String(session.metadata?.promo_code ?? "").trim() || null,
    promo_discount: Number.isFinite(promoCents) ? Math.max(0, promoCents / 100) : null,
    total:
      typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
        ? session.amount_total / 100
        : null,
    currency: String(session.currency ?? "cad").toUpperCase(),
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    shipping_address: String(session.metadata?.shipping_address ?? "").trim() || null,
    shipping_method: String(session.metadata?.shipping_method ?? "").trim() || null,
    payment_id: paymentId,
    stripe_session_id: session.id,
    stripe_email: stripeEmail,
    items: args.items ?? [],
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

  const metaOrderId = String(session.metadata?.order_id || "");
  const packed = session.metadata?.cart || "";
  const wanted = parsePackedCart(packed);

  const { data: existing } = await supabase
    .from("orders")
    .select("order_id,status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  const st = String(existing?.status ?? "").toLowerCase();
  if (existing?.order_id && (st === "paid" || st === "fulfilled" || st === "refunded")) {
    const existingRow = await getOrderRow(supabase, {
      orderId: existing.order_id,
      sessionId: session.id,
    });

    if (existingRow) return orderRowToSummary(existingRow, true);

    return fallbackSummaryFromSession({
      session,
      duplicate: true,
      orderId: existing.order_id,
    });
  }

  if (!wanted.length) {
    throw new Error("No cart metadata found on session.");
  }

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

  const items = wanted.map((w) => {
    const p = pMap.get(w.productId)!;
    return {
      product_id: p.id,
      quantity: w.quantity,
      unit_price_cents: Math.round(Number(p.price) * 100),
      name: p.name,
    };
  });

  const subtotalCents = items.reduce(
    (sum, it) => sum + it.unit_price_cents * it.quantity,
    0
  );

  const metaShippingCents = Number(session.metadata?.shipping_cost_cents ?? 0);
  const shippingCents = Number.isFinite(metaShippingCents) ? Math.max(0, metaShippingCents) : 0;

  const metaPromoCents = Number(session.metadata?.promo_discount_cents ?? 0);
  const promoCents = Number.isFinite(metaPromoCents) ? Math.max(0, metaPromoCents) : 0;

  const promoCode =
    typeof session.metadata?.promo_code === "string" ? session.metadata.promo_code : null;

  const taxCents = Math.max(0, amountTotalCents - (subtotalCents - promoCents) - shippingCents);

  const updatePayload: Record<string, unknown> = {
    stripe_session_id: session.id,
    stripe_email: stripeEmail,
    items,
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    total: amountTotalCents / 100,
    amount_total_cents: amountTotalCents,
    currency,
    payment_method: "stripe",
    payment_id: paymentId,
    status: "paid",
    purchase_date: new Date().toISOString(),
    shipping_cost: shippingCents / 100,
    promo_code: promoCode,
    promo_discount: promoCents / 100,
  };

  if (customerEmail) {
    updatePayload.customer_email = customerEmail;
  }

  const updateQuery = metaOrderId
    ? supabase
        .from("orders")
        .update(updatePayload)
        .eq("order_id", metaOrderId)
        .eq("status", "pending")
    : supabase
        .from("orders")
        .update(updatePayload)
        .eq("stripe_session_id", session.id)
        .eq("status", "pending");

  const { data: updated, error: updErr } = await updateQuery.select("order_id").maybeSingle();
  if (updErr) throw new Error(updErr.message);

  if (!updated?.order_id) {
    const duplicateRow = await getOrderRow(supabase, {
      orderId: metaOrderId || null,
      sessionId: session.id,
    });

    if (duplicateRow) return orderRowToSummary(duplicateRow, true);

    return fallbackSummaryFromSession({
      session,
      duplicate: true,
      orderId: metaOrderId || null,
    });
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

  const fallbackItems: FulfilledOrderItem[] = items.map((it) => {
    const qty = Math.max(1, Number(it.quantity ?? 1));
    const unitPrice = Number(it.unit_price_cents ?? 0) / 100;

    return {
      productId: String(it.product_id ?? "").trim() || null,
      name: String(it.name ?? "Item"),
      qty,
      unitPrice,
      lineTotal: Number((unitPrice * qty).toFixed(2)),
    };
  });

  return fallbackSummaryFromSession({
    session,
    duplicate: false,
    orderId,
    items: fallbackItems,
  });
}
