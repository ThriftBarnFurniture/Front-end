import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";
import OrdersTable from "./OrdersTable";

export default async function AdminOrdersPage() {
  await requireAdmin();

  const supabase = createSupabaseAdmin();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      order_id,
      order_number,
      customer_email,
      customer_name,
      customer_phone,
      shipping_address,
      stripe_email,
      status,
      currency,
      channel,
      purchase_date,
      payment_method,
      payment_id,
      stripe_session_id,
      amount_total_cents,
      subtotal,
      tax,
      shipping_cost,
      promo_code,
      promo_discount,
      shipping_method,
      shipping_distance_km,
      overweight_fee,
      total,
      items
      `
    )
    .order("purchase_date", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Orders</h1>
        <p>Failed to load orders: {error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, marginTop: '150px', paddingBottom: '100px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Orders</h1>
      <OrdersTable initialOrders={orders ?? []} />
    </div>
  );
}
