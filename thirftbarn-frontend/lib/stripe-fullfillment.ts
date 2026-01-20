import Stripe from "stripe";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type WantedItem = { productId: string; quantity: number };

function parsePackedCart(packed: string): WantedItem[] {
  // packed = "uuid:2,uuid:1"
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

export async function fulfillStripeCheckoutSession(
  session: Stripe.Checkout.Session
) {
  const supabase = createSupabaseAdmin();

  // Prefer order_id from metadata (created at checkout)
  const metaOrderId = String(session.metadata?.order_id || "");
  const packed = session.metadata?.cart || "";
  const wanted = parsePackedCart(packed);

  // Idempotency: if we already marked this session/order as paid, skip
  // (your schema uses stripe_session_id + status)
  const { data: existing } = await supabase
    .from("orders")
    .select("order_id,status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing?.order_id && String(existing.status).toLowerCase() === "paid") {
    return { order_id: existing.order_id, duplicate: true };
  }

  if (!wanted.length) {
    throw new Error("No cart metadata found on session.");
  }

  // Load products again (server-trusted)
  const ids = wanted.map((w) => w.productId);

  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id,name,price,image_url,quantity,is_active")
    .in("id", ids);

  if (pErr) throw new Error(pErr.message);
  if (!products || !products.length) throw new Error("Products not found for order.");

  const pMap = new Map(products.map((p) => [p.id, p]));

  // Validate availability again (best effort)
  for (const w of wanted) {
    const p = pMap.get(w.productId);
    if (!p) throw new Error("Missing product in webhook validation.");
    if (!p.is_active) throw new Error(`Inactive product purchased: ${p.name}`);
    if (typeof p.quantity === "number" && p.quantity < w.quantity) {
      throw new Error(`Oversell detected for: ${p.name}`);
    }
  }

  const amount_total_cents = session.amount_total ?? 0;
  const currency = session.currency ?? "cad";
  const stripe_email = session.customer_details?.email ?? (session.customer_email as string | null) ?? null;
  const customer_email = typeof session.metadata?.customer_email === "string" ? session.metadata.customer_email : null;
  const payment_id = typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Rebuild items snapshot to store into orders.items (jsonb)
  const items = wanted.map((w) => {
    const p = pMap.get(w.productId)!;
    return {
      product_id: p.id,
      quantity: w.quantity,
      unit_price_cents: Math.round(Number(p.price) * 100),
      name: p.name,
    };
  });

  const subtotal_cents = items.reduce(
    (sum, it) => sum + it.unit_price_cents * it.quantity,
    0
  );
  const metaShippingCents = Number(session.metadata?.shipping_cost_cents ?? 0);
  const shipping_cents = Number.isFinite(metaShippingCents) ? Math.max(0, metaShippingCents) : 0;

  const metaPromoCents = Number(session.metadata?.promo_discount_cents ?? 0);
  const promo_cents = Number.isFinite(metaPromoCents) ? Math.max(0, metaPromoCents) : 0;

  const promo_code = typeof session.metadata?.promo_code === "string" ? session.metadata.promo_code : null;

  const tax_cents = Math.max(0, amount_total_cents - (subtotal_cents - promo_cents) - shipping_cents);
  const shipping_cost = Math.max(0, (amount_total_cents - subtotal_cents - tax_cents) / 100);

  // Common update payload (avoid duplicating)
  const updatePayload: Record<string, any> = {
    stripe_session_id: session.id,
    stripe_email, // ✅ store Stripe email separately
    items,
    subtotal: subtotal_cents / 100,
    tax: tax_cents / 100,
    total: amount_total_cents / 100,
    amount_total_cents,
    currency,
    payment_method: "stripe",
    payment_id,
    status: "paid",
    purchase_date: new Date().toISOString(),
    shipping_cost: shipping_cents / 100,
    promo_code,
    promo_discount: promo_cents / 100,
  };

  // IMPORTANT: only set customer_email if it's present (prevents overwriting with null)
  if (customer_email) {
    updatePayload.customer_email = customer_email;
  }

  // Decide which order row to update
  // 1) if we have metaOrderId, update that
  // 2) else fall back to stripe_session_id match
  const orderMatch = metaOrderId
    ? supabase.from("orders").update(updatePayload).eq("order_id", metaOrderId)
    : supabase.from("orders").update(updatePayload).eq("stripe_session_id", session.id);

  const { data: updated, error: updErr } = await orderMatch.select("order_id").single();
  if (updErr) throw new Error(updErr.message);

  const order_id = updated.order_id as string;

  // Decrement inventory + write inventory_events
  for (const w of wanted) {
    const p = pMap.get(w.productId)!;
    const newQty = (Number(p.quantity) || 0) - w.quantity;

    const { error: prodErr } = await supabase
      .from("products")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", w.productId);

    if (prodErr) throw new Error(prodErr.message);

    const { error: logErr } = await supabase.from("inventory_events").insert({
      product_id: w.productId,
      delta: -w.quantity,
      reason: "sale",
      source: "stripe_web",
      order_id,
      created_at: new Date().toISOString(),
    });

    if (logErr) {
      console.error("Failed to record inventory event.", logErr);
    }
  }

  return { order_id };
}
