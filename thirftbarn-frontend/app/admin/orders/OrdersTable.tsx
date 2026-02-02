"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./orders.module.css";

type AnyObj = Record<string, any>;

type OrderItemUI = {
  name: string;
  qty: number;
  unitPrice: number | null;
  image_url?: string | null;
  id?: string | null;
};

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

  // stored JSON / array / whatever
  items: any;

  // optional extras (if present in your orders table)
  customer_name?: string | null;
  customer_phone?: string | null;
  shipping_address?: string | null;

  subtotal?: number | null;
  tax?: number | null;
  shipping_cost?: number | null;

  promo_code?: string | null;
  promo_discount?: number | null;

  stripe_email?: string | null;
};

function formatDate(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "America/Toronto",
  }).format(new Date(ts));
}



function money(n: number | null | undefined, currency = "CAD") {
  const val = typeof n === "number" && Number.isFinite(n) ? n : null;
  if (val === null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(val);
}

function safeUpper(s: string | null | undefined) {
  return String(s ?? "").trim().toUpperCase() || "—";
}

function safeText(s: any) {
  const t = String(s ?? "").trim();
  return t || "—";
}

function parseItems(raw: any): OrderItemUI[] {
  // If stored as JSON string wrapper
  if (typeof raw === "string") {
    try {
      return parseItems(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  // If stored as array (your case: text[] => string[])
  if (Array.isArray(raw)) {
    const objs: AnyObj[] = raw
      .map((x) => {
        if (!x) return null;

        // text[] element: JSON string
        if (typeof x === "string") {
          try {
            return JSON.parse(x);
          } catch {
            return null;
          }
        }

        // already an object
        if (typeof x === "object") return x;

        return null;
      })
      .filter(Boolean) as AnyObj[];

    return objs
      .map((it): OrderItemUI | null => {
        const name =
          String(it.name ?? it.product_name ?? it.title ?? it.description ?? "").trim() || "Item";

        const qtyRaw = it.qty ?? it.quantity ?? it.count ?? 1;
        const qty = Number.isFinite(Number(qtyRaw)) ? Math.max(1, Number(qtyRaw)) : 1;

        // Prefer cents fields first (matches your checkout success logic)
        const centsRaw =
          it.unit_price_cents ??
          it.unitPriceCents ??
          it.unit_amount_cents ??
          it.amount_cents ??
          null;

        let unitPrice: number | null = null;

        if (centsRaw !== null && Number.isFinite(Number(centsRaw))) {
          unitPrice = Number(centsRaw) / 100;
        } else {
          // fallback: dollar fields
          const dollarsRaw = it.unit_price ?? it.price ?? it.unitPrice ?? it.amount ?? null;
          if (dollarsRaw !== null && Number.isFinite(Number(dollarsRaw))) {
            unitPrice = Number(dollarsRaw);
          }
        }

        return {
          id: it.product_id ?? it.productId ?? it.id ?? null,
          name,
          qty,
          unitPrice,
          image_url: it.image_url ?? it.image ?? it.imageUrl ?? null,
        };
      })
      .filter(Boolean) as OrderItemUI[];
  }

  // If object wrapper like { items: [...] }
  if (raw && typeof raw === "object") {
    if (Array.isArray((raw as AnyObj).items)) return parseItems((raw as AnyObj).items);
  }

  return [];
}

function computeSubtotal(items: OrderItemUI[]) {
  const sum = items.reduce((acc, it) => {
    const line = it.unitPrice !== null ? it.unitPrice * it.qty : 0;
    return acc + line;
  }, 0);
  return Number.isFinite(sum) ? sum : 0;
}

function bestTotal(o: OrderRow) {
  if (typeof o.total === "number" && Number.isFinite(o.total)) return o.total;
  if (typeof o.amount_total_cents === "number" && Number.isFinite(o.amount_total_cents))
    return o.amount_total_cents / 100;
  return 0;
}

export default function OrdersTable({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const selected = useMemo(
    () => orders.find((o) => o.order_id === openId) ?? null,
    [orders, openId]
  );

  async function markFulfilled(orderId: string) {
    setErr(null);
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/fulfill`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());

      setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, status: "fulfilled" } : o)));
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

      setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, status: "refunded" } : o)));
    } catch (e: any) {
      setErr(e?.message ?? "Refund failed.");
    } finally {
      setBusyId(null);
    }
  }

  const closeModal = () => setOpenId(null);

  const [productMap, setProductMap] = useState<Record<string, { image_url: string | null }>>({});

  useEffect(() => {
    if (!selected) {
      setProductMap({});
      return;
    }

    const items = parseItems(selected.items);
    const ids = Array.from(new Set(items.map((i) => i.id).filter(Boolean))) as string[];

    if (ids.length === 0) {
      setProductMap({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/admin/products/by-ids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Failed to load product images.");

        if (!cancelled) setProductMap((json?.products ?? {}) as Record<string, { image_url: string | null }>);
      } catch (e) {
        console.warn("Failed to load product images", e);
        if (!cancelled) setProductMap({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div className={styles.wrap}>
      {err && (
        <div className={styles.errorBox}>
          <strong>Error:</strong> {err}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.theadRow}>
              <th className={styles.th}>Order</th>
              <th className={styles.th}>Date</th>
              <th className={styles.th}>Customer</th>
              <th className={styles.th}>Channel</th>
              <th className={styles.th}>Total</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((o) => {
              const status = String(o.status ?? "").toLowerCase();

              const canFulfill = status === "paid";
              const canRefund = status === "paid" || status === "fulfilled";
              const refundBlocked = status === "chargeback" || status === "disputed" || status === "refunded";

              return (
                <tr
                  key={o.order_id}
                  className={styles.tr}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(o.order_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setOpenId(o.order_id);
                  }}
                >
                  <td className={styles.td}>
                    <div className={styles.orderMain}>{o.order_number ?? o.order_id}</div>
                    <div className={styles.orderSub}>{o.order_id}</div>
                  </td>

                  <td className={styles.td}>
                    {formatDate(o.purchase_date)}
                  </td>

                  <td className={styles.td}>{o.customer_email ?? "—"}</td>

                  <td className={styles.td}>{safeUpper(o.channel ?? "—")}</td>

                  <td className={styles.td}>
                    {money(bestTotal(o), safeUpper(o.currency || "cad"))}
                  </td>

                  <td className={styles.td}>
                    <span className={styles.status}>{safeUpper(o.status ?? "—")}</span>
                  </td>

                  <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button
                        className={styles.btn}
                        onClick={() => markFulfilled(o.order_id)}
                        disabled={busyId === o.order_id || !canFulfill}
                        title={!canFulfill ? "Only paid orders can be fulfilled." : undefined}
                      >
                        {busyId === o.order_id ? "Working…" : "Mark fulfilled"}
                      </button>

                      <button
                        className={styles.btn}
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
                <td className={styles.td} colSpan={7}>
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Details Modal */}
      {selected && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>
                  Order {selected.order_number ?? selected.order_id}
                </div>
                <div className={styles.modalSubtitle}>
                  {formatDate(selected.purchase_date)} • 
                  {safeUpper(selected.status)} • {safeUpper(selected.channel)} • {safeUpper(selected.currency || "cad")}
                </div>
              </div>

              <button className={styles.iconBtn} onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {(() => {
                const items = parseItems(selected.items);
                const computedSub = computeSubtotal(items);

                const currency = safeUpper(selected.currency || "cad");
                const total = bestTotal(selected);

                const subtotalRaw =
                  typeof selected.subtotal === "number" && Number.isFinite(selected.subtotal)
                    ? selected.subtotal
                    : null;

                const subtotal =
                  subtotalRaw !== null && (subtotalRaw !== 0 || computedSub === 0)
                    ? subtotalRaw
                    : computedSub;

                const tax =
                  typeof selected.tax === "number" && Number.isFinite(selected.tax) ? selected.tax : null;

                const shipping =
                  typeof selected.shipping_cost === "number" && Number.isFinite(selected.shipping_cost)
                    ? selected.shipping_cost
                    : null;

                const promo =
                  typeof selected.promo_discount === "number" && Number.isFinite(selected.promo_discount)
                    ? selected.promo_discount
                    : null;

                return (
                  <>
                    <div className={styles.sectionGrid}>
                      <div className={styles.section}>
                        <div className={styles.sectionTitle}>Customer</div>
                        <div className={styles.kv}>
                          <div className={styles.k}>Name</div>
                          <div className={styles.v}>{safeText(selected.customer_name)}</div>

                          <div className={styles.k}>Email</div>
                          <div className={styles.v}>{safeText(selected.customer_email ?? selected.stripe_email)}</div>

                          <div className={styles.k}>Phone</div>
                          <div className={styles.v}>{safeText(selected.customer_phone)}</div>

                          <div className={styles.k}>Address</div>
                          <div className={styles.v}>{safeText(selected.shipping_address)}</div>
                        </div>
                      </div>

                      <div className={styles.section}>
                        <div className={styles.sectionTitle}>Payment</div>
                        <div className={styles.kv}>
                          <div className={styles.k}>Stripe Session</div>
                          <div className={styles.v}>{safeText(selected.stripe_session_id)}</div>

                          <div className={styles.k}>Payment ID</div>
                          <div className={styles.v}>{safeText(selected.payment_id)}</div>

                          <div className={styles.k}>Promo Code</div>
                          <div className={styles.v}>{safeText(selected.promo_code)}</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>Price breakdown</div>
                      <div className={styles.breakdown}>
                        <div className={styles.row}>
                          <span className={styles.muted}>Subtotal</span>
                          <span>{money(subtotal, currency)}</span>
                        </div>

                        <div className={styles.row}>
                          <span className={styles.muted}>Tax</span>
                          <span>{tax === null ? "—" : money(tax, currency)}</span>
                        </div>

                        <div className={styles.row}>
                          <span className={styles.muted}>Shipping</span>
                          <span>{shipping === null ? "—" : money(shipping, currency)}</span>
                        </div>

                        <div className={styles.row}>
                          <span className={styles.muted}>Discount</span>
                          <span>
                            {promo === null ? "—" : `- ${money(Math.abs(promo), currency)}`}
                          </span>
                        </div>

                        <div className={styles.hr} />

                        <div className={styles.rowTotal}>
                          <span>Total</span>
                          <span>{money(total, currency)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>Items</div>

                      {items.length === 0 ? (
                        <div className={styles.muted}>No items found on this order.</div>
                      ) : (
                        <div className={styles.items}>
                          {items.map((it, idx) => (
                            <div key={`${it.id ?? it.name}-${idx}`} className={styles.itemRow}>
                              <div className={styles.itemLeft}>
                                <div className={styles.itemThumb}>
                                  {it.id && productMap[it.id]?.image_url ? (
                                    <img
                                      src={productMap[it.id]!.image_url!}
                                      alt={it.name}
                                      className={styles.itemThumbImg}
                                    />
                                  ) : (
                                    <div className={styles.itemThumbFallback} />
                                  )}
                                </div>

                                <div className={styles.itemInfo}>
                                  <div className={styles.itemName}>{it.name}</div>
                                  <div className={styles.itemMeta}>
                                    Qty: <strong>{it.qty}</strong>
                                    {it.unitPrice !== null && <> • Unit: {money(it.unitPrice, currency)}</>}
                                  </div>
                                </div>
                              </div>

                              <div className={styles.itemRight}>
                                {it.unitPrice !== null ? money(it.unitPrice * it.qty, currency) : "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btn} onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
