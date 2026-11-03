"use client";

import Image from "next/image";
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
  items: unknown;
  private_details_available?: boolean;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string | null;

  stripe_email?: string | null;
  shipping_cost?: number | null;
  promo_code?: string | null;
  promo_discount?: number | null;
};

type OrderDisplayItem = {
  product_id?: string; productId?: string; name?: string; quantity?: number; qty?: number;
  unit_price_cents?: number; unitPriceCents?: number;
};

type ProductMini = {
  id: string;
  name: string | null;
  image_url: string | null;
  price: number | null;
  is_oversized?: boolean | null;
};

export default function CheckoutSuccessClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { clear } = useCart();
  const sessionId = params.get("session_id");
  const orderIdParam = params.get("order_id");

  const [loading, setLoading] = useState(Boolean(sessionId || orderIdParam));
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [prodMap, setProdMap] = useState<Record<string, ProductMini>>({});

  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsSignedIn(!!data.user));
  }, []);


  // Confirm payment first, then fetch the receipt. Never clear the cart just
  // because a redirect URL contains a session ID.
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const pause = (ms: number) => new Promise<void>((resolve) => {
      retryTimer = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => { clearTimeout(retryTimer); resolve(); }, { once: true });
    });

    async function load() {
      setLoading(true);
      setError(null);
      setOrder(null);
      try {
        if (sessionId) {
          let confirmed = false;
          for (let attempt = 0; attempt < 4; attempt++) {
            if (signal.aborted) return;
            const response = await fetch("/api/stripe/complete", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }), signal,
            });
            const result = await response.json().catch(() => ({}));
            if (response.ok && result.confirmed === true) { confirmed = true; break; }
            if (response.status >= 400 && response.status < 500) {
              throw new Error(result.error || "This checkout link could not be verified.");
            }
            if (attempt < 3) await pause(1500 * (attempt + 1));
          }
          if (!confirmed) throw new Error("Payment confirmation is still pending. Please refresh shortly or contact us before paying again.");
          if (signal.aborted) return;
          const response = await fetch("/api/orders/by-session", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }), signal,
          });
          const result = await response.json();
          if (!response.ok || !result.order) throw new Error(result.error || "Your receipt is not ready yet. Please refresh shortly.");
          if (!signal.aborted) {
            setOrder(result.order as OrderRow);
            if (["paid", "fulfilled"].includes(String(result.order.status))) clear();
          }
        } else if (orderIdParam) {
          const client = createClient();
          const { data: auth } = await client.auth.getUser();
          if (!auth.user) throw new Error("Please log in to view this order.");
          const { data, error: lookupError } = await client.from("orders").select("*")
            .eq("order_id", orderIdParam).eq("user_id", auth.user.id).single();
          if (lookupError || !data) throw new Error("This order could not be loaded.");
          if (!signal.aborted) setOrder({ ...data, private_details_available: true } as OrderRow);
        }
      } catch (err: unknown) {
        if (!signal.aborted) setError(err instanceof Error ? err.message : "Unable to confirm this checkout.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(retryTimer); };
  }, [sessionId, orderIdParam, clear]);

  const items: OrderDisplayItem[] = useMemo(() => {
    const raw = order?.items;
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [];

    return arr
      .map((x) => {
        if (!x) return null;
        if (typeof x === "object") return x as OrderDisplayItem;
        if (typeof x === "string") {
          try {
            return JSON.parse(x) as OrderDisplayItem;
          } catch {
            return null;
          }
        }
        return null;
      })
      .filter((item): item is OrderDisplayItem => item !== null);
  }, [order]);

  // Fetch images (and name fallback) from products table using product_id(s)
  useEffect(() => {
    if (!order) return;

    const productIds = items
      .map((it) => String(it.product_id ?? it.productId ?? ""))
      .filter(Boolean);

    const unique = Array.from(new Set(productIds));
    if (unique.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const supabase = await createClient();

        const { data, error } = await supabase
          .from("products")
          .select("id,name,image_url,price")
          .in("id", unique);

        if (error) throw new Error(error.message);

        const next: Record<string, ProductMini> = {};
        for (const p of (data || []) as ProductMini[]) next[p.id] = p;

        if (!cancelled) setProdMap(next);
      } catch (e) {
        console.warn("Failed to load product images for order.", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order, items]);

  const shipping = Number(order?.shipping_cost ?? 0);
  const promo = Number(order?.promo_discount ?? 0);
  const promoCode = String(order?.promo_code ?? "").trim();
  const currency = String(order?.currency ?? "cad").toUpperCase();

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>
        {loading ? "Confirming your order" : order?.status === "refunded" ? "Order refunded" :
          order?.status === "chargeback" ? "Order payment disputed" :
          order && ["paid", "fulfilled"].includes(String(order.status)) ? "Payment confirmed" :
          sessionId || orderIdParam ? "Order confirmation pending" : "No checkout to confirm"}
      </h1>
      <p className={styles.subtitle}>
        {order && ["paid", "fulfilled"].includes(String(order.status))
          ? "Thank you! Your payment has been confirmed."
          : "Your cart is kept until payment is confirmed. You can return to the shop or check your order history."}
      </p>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Order details</h2>

        {loading && <p className={styles.muted}>Loading order…</p>}

        {!loading && error && (
          <p className={styles.muted} role="alert">
            Couldn’t load your order yet. Try refreshing.
            <br />
            <span className={styles.error}>({error})</span>
          </p>
        )}

        {!loading && !error && !order && (
          <p className={styles.muted}>We haven’t linked this payment to an order yet.</p>
        )}

        {!loading && !error && order && (
          <>
            <p className={styles.orderHeader}>
              Order <strong>{order.order_number ?? order.order_id}</strong> •{" "}
              <strong>{String(order.status ?? "").toUpperCase()}</strong>
            </p>

            {order.private_details_available !== false ? <div className={styles.clientBox}>
              <div className={styles.clientTitle}>Client information</div>

              <div className={styles.clientGrid}>
                <div className={styles.clientRow}>
                  <span>Name</span>
                  <strong>{order.customer_name ?? "—"}</strong>
                </div>

                <div className={styles.clientRow}>
                  <span>Email</span>
                  <strong>{order.customer_email ?? "—"}</strong>
                </div>

                <div className={styles.clientRow}>
                  <span>Phone</span>
                  <strong>{order.customer_phone ?? "—"}</strong>
                </div>

                <div className={styles.clientRow}>
                  <span>Address</span>
                  <strong>{order.shipping_address ?? "—"}</strong>
                </div>
              </div>
            </div> : <p className={styles.muted}>For your privacy, contact and delivery details are available in the browser used for checkout or your signed-in account.</p>}

            {items.length > 0 && (
              <div className={styles.items}>
                {items.map((it, idx) => {
                  const anyIt = it;

                  const pid = String(anyIt?.product_id ?? anyIt?.productId ?? "");
                  const p = pid ? prodMap[pid] : undefined;

                  const qty = Math.max(1, Number(anyIt?.quantity ?? anyIt?.qty ?? 1));

                  const unitCents =
                    typeof anyIt?.unit_price_cents === "number"
                      ? anyIt.unit_price_cents
                      : typeof anyIt?.unitPriceCents === "number"
                      ? anyIt.unitPriceCents
                      : typeof p?.price === "number"
                      ? Math.round(p.price * 100)
                      : null;

                  const name = anyIt?.name ?? p?.name ?? "Item";

                  const unit =
                    typeof unitCents === "number" ? (unitCents / 100).toFixed(2) : "—";

                  const lineTotal =
                    typeof unitCents === "number" ? ((unitCents * qty) / 100).toFixed(2) : "—";

                  return (
                    <div key={idx} className={styles.itemRow}>
                      <div className={styles.itemLeft}>
                        <div className={styles.thumb}>
                          {p?.image_url ? (
                            <Image
                              src={p.image_url}
                              alt={name}
                              fill
                              className={styles.thumbImg}
                              sizes="64px"
                            />
                          ) : (
                            <div className={styles.thumbFallback} />
                          )}
                        </div>

                        <div>
                          <div className={styles.itemName}>{name}</div>
                          <div className={styles.mutedSmall}>Qty: {qty}</div>
                          <div className={styles.mutedSmall}>
                            Unit: {unit} {currency}
                          </div>
                        </div>
                      </div>

                      <div className={styles.price}>
                        {lineTotal} {currency}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.summary}>
              <div>
                <span>Subtotal</span>
                <strong>{Number(order.subtotal ?? 0).toFixed(2)} {currency}</strong>
              </div>

              {/* ✅ Promo */}
              <div>
                <span>
                  Promo{promoCode ? ` (${promoCode})` : ""}
                </span>
                <strong>{promo > 0 ? `-${promo.toFixed(2)}` : "0.00"} {currency}</strong>
              </div>

              {/* ✅ Shipping */}
              <div>
                <span>Shipping</span>
                <strong>{shipping > 0 ? shipping.toFixed(2) : "0.00"} {currency}</strong>
              </div>

              <div>
                <span>Tax</span>
                <strong>{Number(order.tax ?? 0).toFixed(2)} {currency}</strong>
              </div>

              <div className={styles.totalRow}>
                <span>Total</span>
                <strong>
                  {Number(order.total ?? 0).toFixed(2)} {currency}
                </strong>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <button onClick={() => router.push("/shop")}>Continue shopping</button>
        {isSignedIn && (
          <button onClick={() => router.push("/account/orders")}>View orders</button>
        )}
      </div>
    </div>
  );
}
