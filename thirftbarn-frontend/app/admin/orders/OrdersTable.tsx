"use client";

import { useState } from "react";

type OrderRow = {
  order_id: string;
  order_number: string | null;
  customer_email: string | null;
  status: string | null;
  total: number | null;
  currency: string | null;
  channel: string | null;
  purchase_date: string | null;
  stripe_session_id: string | null;
  payment_id: string | null;
  amount_total_cents: number | null;
  items: any;
};

export default function OrdersTable({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function markFulfilled(orderId: string) {
    setErr(null);
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/fulfill`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());

      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status: "fulfilled" } : o))
      );
    } catch (e: any) {
      setErr(e?.message ?? "Failed to fulfill.");
    } finally {
      setBusyId(null);
    }
  }

  async function refund(orderId: string) {
    if (!confirm("Refund this order? This will create a Stripe refund.")) return;

    setErr(null);
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());

      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status: "refunded" } : o))
      );
    } catch (e: any) {
      setErr(e?.message ?? "Refund failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      {err && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "rgba(255,0,0,0.06)",
          }}
        >
          <strong>Error:</strong> {err}
        </div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.04)" }}>
              <th style={th}>Order</th>
              <th style={th}>Date</th>
              <th style={th}>Customer</th>
              <th style={th}>Channel</th>
              <th style={th}>Total</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((o) => {
              const status = String(o.status ?? "").toLowerCase();

              const canFulfill = status === "paid";
              const canRefund = status === "paid" || status === "fulfilled";
              const refundBlocked = status === "chargeback" || status === "disputed" || status === "refunded";

              return (
                <tr key={o.order_id}>
                  <td style={td}>
                    <div style={{ fontWeight: 900 }}>{o.order_number ?? o.order_id}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{o.order_id}</div>
                  </td>

                  <td style={td}>
                    {o.purchase_date ? new Date(o.purchase_date).toLocaleString() : "—"}
                  </td>

                  <td style={td}>{o.customer_email ?? "—"}</td>

                  <td style={td}>{String(o.channel ?? "—").toUpperCase()}</td>

                  <td style={td}>
                    {Number(o.total ?? 0).toFixed(2)} {String(o.currency ?? "cad").toUpperCase()}
                  </td>

                  <td style={td}>
                    <strong>{String(o.status ?? "—").toUpperCase()}</strong>
                  </td>

                  <td style={td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => markFulfilled(o.order_id)}
                        disabled={busyId === o.order_id || !canFulfill}
                        title={!canFulfill ? "Only paid orders can be fulfilled." : undefined}
                      >
                        Mark fulfilled
                      </button>

                      <button
                        onClick={() => refund(o.order_id)}
                        disabled={busyId === o.order_id || !canRefund || refundBlocked}
                        title={
                          refundBlocked
                            ? "Refund unavailable (already refunded or chargeback/dispute)."
                            : !canRefund
                            ? "Only paid/fulfilled orders can be refunded."
                            : undefined
                        }
                      >
                        Refund
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!orders.length && (
              <tr>
                <td style={td} colSpan={7}>
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        button {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.18);
          background: rgba(0, 0, 0, 0.08);
          cursor: pointer;
          font-weight: 800;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 12, fontWeight: 900 };
const td: React.CSSProperties = { padding: 12, borderTop: "1px solid rgba(0,0,0,0.08)" };
