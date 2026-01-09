import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";
import OrdersTable from "./OrdersTable";

export default async function AdminOrdersPage() {
  await requireAdmin();

  const supabase = createSupabaseAdmin();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "order_id, order_number, customer_email, status, total, currency, channel, purchase_date, stripe_session_id, payment_id, amount_total_cents, items"
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
    <div style={{ padding: 24, marginTop: '200px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Orders</h1>
      <OrdersTable initialOrders={orders ?? []} />
    </div>
  );
}
