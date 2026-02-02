import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import accountStyles from "../account.module.css";
import styles from "./orders.module.css";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  return (
    <div className={accountStyles.page}>
      <div className={accountStyles.container}>
        <div className={accountStyles.header}>
          <div className={accountStyles.titleWrap}>
            <h1 className={accountStyles.h1}>Orders</h1>
            <p className={accountStyles.sub}>Your order history.</p>
          </div>
        </div>

        {!auth.user ? (
          <p>
            Please <Link href="/login">log in</Link> to view your order history.
          </p>
        ) : (
          <OrdersList userId={auth.user.id} />
        )}
      </div>
    </div>
  );
}

async function OrdersList({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("order_id, order_number, purchase_date, status, total, currency, channel")
    .eq("user_id", userId)
    .order("purchase_date", { ascending: false });

  if (error) return <p>Could not load orders: {error.message}</p>;

  if (!orders?.length) return <p>No orders yet.</p>;

  return (
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

          <div className={styles.orderActions}>
            <Link className={styles.viewLink} href={`/account/orders/${o.order_id}`}>
              View
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
