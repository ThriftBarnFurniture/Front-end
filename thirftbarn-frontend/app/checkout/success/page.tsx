"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { createClient } from "@/utils/supabase/client";
import styles from "./success.module.css";

type OrderRow = {
  order_id: string;
  order_number: string | null;
  status: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  purchase_date: string | null;
  items: any; // jsonb
};

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { clear } = useCart();

  const sessionId = params.get("session_id");

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear cart after successful checkout
  useEffect(() => {
    clear();
  }, [clear]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function loadOrder() {
      setLoading(true);
      setError(null);

      try {
        const supabase = await createClient();

        const { data, error } = await supabase
          .from("orders")
          .select(
            "order_id,order_number,status,currency,subtotal,tax,total,purchase_date,items"
          )
          .eq("stripe_session_id", sessionId)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!cancelled) setOrder(data as OrderRow);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const items = useMemo(() => {
    const raw = (order?.items as any[]) ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [order]);

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Payment successful ✅</h1>
      <p className={styles.subtitle}>
        Thank you! Your order is being processed.
      </p>

      {sessionId && (
        <p className={styles.session}>
          Session: <code>{sessionId}</code>
        </p>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Order details</h2>

        {loading && <p className={styles.muted}>Loading order…</p>}

        {!loading && error && (
          <p className={styles.muted}>
            Couldn’t load your order yet. Try refreshing.
            <br />
            <span className={styles.error}>({error})</span>
          </p>
        )}

        {!loading && !error && !order && (
          <p className={styles.muted}>
            We haven’t linked this payment to an order yet.
          </p>
        )}

        {!loading && !error && order && (
          <>
            <p className={styles.orderHeader}>
              Order{" "}
              <strong>{order.order_number ?? order.order_id}</strong> •{" "}
              <strong>{String(order.status ?? "").toUpperCase()}</strong>
            </p>

            {items.length > 0 && (
              <div className={styles.items}>
                {items.map((it: any, idx: number) => (
                  <div key={idx} className={styles.itemRow}>
                    <div>
                      <div className={styles.itemName}>
                        {it?.name ?? "Item"}
                      </div>
                      <div className={styles.mutedSmall}>
                        Qty: {it?.quantity ?? 1}
                      </div>
                    </div>
                    <div className={styles.price}>
                      {typeof it?.unit_price_cents === "number"
                        ? (it.unit_price_cents / 100).toFixed(2)
                        : "—"}{" "}
                      {String(order.currency ?? "cad").toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.summary}>
              <div>
                <span>Subtotal</span>
                <strong>{Number(order.subtotal ?? 0).toFixed(2)}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{Number(order.tax ?? 0).toFixed(2)}</strong>
              </div>
              <div className={styles.totalRow}>
                <span>Total</span>
                <strong>
                  {Number(order.total ?? 0).toFixed(2)}{" "}
                  {String(order.currency ?? "cad").toUpperCase()}
                </strong>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <button onClick={() => router.push("/shop")}>
          Continue shopping
        </button>
        <button onClick={() => router.push("/account/orders")}>
          View orders
        </button>
      </div>
    </div>
  );
}
