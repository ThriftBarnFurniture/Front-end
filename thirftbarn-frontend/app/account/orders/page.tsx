import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import styles from "../account.module.css";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <div className={styles.accountWrap}>
        <h1>Orders</h1>
        <p>
          Please <Link href="/login">log in</Link> to view your order history.
        </p>
      </div>
    );
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "order_id, order_number, purchase_date, status, total, currency, channel"
    )
    .eq("user_id", auth.user.id)
    .order("purchase_date", { ascending: false });

  if (error) {
    return (
      <div className={styles.accountWrap}>
        <h1>Orders</h1>
        <p>Could not load orders: {error.message}</p>
      </div>
    );
  }

  return (
    <div className={styles.accountWrap}>
      <h1>Orders</h1>

      {!orders?.length ? (
        <p>No orders yet.</p>
      ) : (
        <div className={styles.cardList}>
          {orders.map((o) => (
            <div key={o.order_id} className={styles.card}>
              <div className={styles.cardRow}>
                <strong>{o.order_number}</strong>
                <span className={styles.badge}>{o.status}</span>
              </div>
              <div className={styles.muted}>
                {o.purchase_date ? new Date(o.purchase_date).toLocaleString() : "Pending payment"}
                {" • "}
                {String(o.channel).toUpperCase()}
              </div>
              <div className={styles.total}>
                Total: {Number(o.total).toFixed(2)} {String(o.currency || "cad").toUpperCase()}
              </div>

              <div className={styles.actions}>
                <Link href={`/checkout/success?order_id=${o.order_id}`}>View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
