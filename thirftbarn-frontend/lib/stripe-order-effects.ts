import { randomUUID } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { recordSquareSale } from "@/lib/square/inventory";
import { sendAdminOrderEmail, sendCustomerOrderEmail, type OrderEmailPayload } from "@/lib/brevo";
import type { FulfilledOrderSummary } from "@/lib/stripe-fullfillment";

type SquareUpdate = { productId: string; variationId: string; quantity: number; soldQuantity: number };
type OrderEffects = {
  order_id: string;
  stripe_session_id: string;
  square_updates: SquareUpdate[];
  admin_email_sent_at: string | null;
  customer_email_sent_at: string | null;
  created_at: string;
};

function pending(row: OrderEffects | null): boolean {
  return !!row && (row.square_updates.length > 0 || !row.admin_email_sent_at || !row.customer_email_sent_at);
}

export function orderEmailPayload(order: FulfilledOrderSummary): OrderEmailPayload {
  return {
    orderId: order.order_id, orderNumber: order.order_number, status: order.status,
    purchaseDate: order.purchase_date, subtotal: order.subtotal, shippingCost: order.shipping_cost,
    promoCode: order.promo_code, promoDiscount: order.promo_discount, tax: order.tax,
    total: order.total, currency: order.currency, customerName: order.customer_name,
    customerEmail: order.customer_email ?? order.stripe_email, customerPhone: order.customer_phone,
    shippingMethod: order.shipping_method, shippingAddress: order.shipping_address,
    paymentId: order.payment_id, stripeSessionId: order.stripe_session_id, items: order.items,
  };
}

/** Returns true while durable work still needs a webhook retry. */
export async function deliverStripeOrderEffects(order: FulfilledOrderSummary): Promise<boolean> {
  const db = createSupabaseAdmin();
  const token = randomUUID();
  const { data, error } = await db.rpc("claim_stripe_order_effects_v1", {
    p_order_id: order.order_id, p_lease_token: token,
  });
  if (error) throw new Error(error.message);
  if (!data) {
    // Another request may own the lease. Completed/historical orders need no
    // work; outstanding leased work must keep the webhook retryable.
    const { data: row, error: readError } = await db.from("stripe_order_effects")
      .select("square_updates,admin_email_sent_at,customer_email_sent_at")
      .eq("order_id", order.order_id).maybeSingle();
    if (readError) throw new Error(readError.message);
    return pending(row as OrderEffects | null);
  }

  const row = data as OrderEffects;
  let updates = row.square_updates;
  let adminSent = !!row.admin_email_sent_at;
  let customerSent = !!row.customer_email_sent_at;
  const deadline = Date.now() + 20000;
  const failures: string[] = [];
  const acknowledge = async (fields: Record<string, unknown>) => {
    const { data: updated, error: writeError } = await db.from("stripe_order_effects")
      .update(fields).eq("order_id", order.order_id).eq("lease_token", token)
      .select("order_id").maybeSingle();
    if (writeError) throw new Error(writeError.message);
    if (!updated) throw new Error("Order notification lease was lost.");
  };
  try {
    for (const update of [...updates]) {
      if (Date.now() >= deadline) break;
      try {
        const count = await recordSquareSale({
          variationId: update.variationId, quantity: update.soldQuantity,
          sessionId: row.stripe_session_id, productId: update.productId,
          occurredAt: row.created_at,
        });
        const { error: syncError } = await db.rpc("apply_square_inventory_count_v1", {
          p_variation_id: update.variationId, p_quantity: count.quantity, p_calculated_at: count.calculatedAt,
          p_completed_order: order.order_id, p_lease_token: token,
        });
        if (syncError) throw new Error(syncError.message);
        const remaining = updates.filter(item => item.productId !== update.productId);
        updates = remaining;
      } catch {
        // Keep provider errors out of stored records: SMTP/HTTP errors may
        // contain customer details or deployment configuration.
        failures.push("Square inventory delivery failed");
      }
    }
    const payload = orderEmailPayload(order);
    if (!adminSent && Date.now() < deadline) {
      try {
        await sendAdminOrderEmail(payload);
        await acknowledge({ admin_email_sent_at: new Date().toISOString() });
        adminSent = true;
      } catch { failures.push("Administrator email delivery failed"); }
    }
    if (!customerSent && Date.now() < deadline) {
      try {
        await sendCustomerOrderEmail(payload);
        await acknowledge({ customer_email_sent_at: new Date().toISOString() });
        customerSent = true;
      } catch { failures.push("Customer email delivery failed"); }
    }
  } finally {
    await acknowledge({ lease_token: null, lease_until: null, last_error: failures.length ? failures.join("; ") : null });
  }
  return updates.length > 0 || !adminSent || !customerSent;
}
