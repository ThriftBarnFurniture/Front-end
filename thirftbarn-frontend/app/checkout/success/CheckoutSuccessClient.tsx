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
  items: any;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string | null;

  stripe_email?: string | null;
  shipping_cost?: number | null;
  promo_code?: string | null;
  promo_discount?: number | null;
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

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [prodMap, setProdMap] = useState<Record<string, ProductMini>>({});

  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsSignedIn(!!data.user));
  }, []);


  // Clear cart after successful checkout
  useEffect(() => {
    if (!sessionId) return;
    clear();
  }, [sessionId, clear]);

  // Load order by stripe_session_id (guest-safe via server endpoint)
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function loadOrder() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/orders/by-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Failed to load order.");

        if (!cancelled) setOrder((json?.order ?? null) as OrderRow | null);
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

  useEffect(() => {
    if (sessionId) return; // session flow already handles it
    if (!orderIdParam) return;

    let cancelled = false;

    async function loadOrderById() {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Please log in to view this order.");

        // RLS should restrict to own orders; adding user_id check is extra safe.
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("order_id", orderIdParam)
          .eq("user_id", auth.user.id)
          .single();

        if (error) throw new Error(error.message);

        if (!cancelled) setOrder((data ?? null) as OrderRow | null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrderById();
    return () => {
      cancelled = true;
    };
  }, [sessionId, orderIdParam]);


  // Finalize checkout
  useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();

    async function finalizeCheckout() {
      try {
        await fetch("/api/stripe/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          signal: controller.signal,
        });
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("Failed to finalize checkout.", e);
      }
    }

    finalizeCheckout();
    return () => controller.abort();
  }, [sessionId]);

  const items: any[] = useMemo(() => {
    const raw = order?.items;
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [];

    return arr
      .map((x) => {
        if (!x) return null;
        if (typeof x === "object") return x;
        if (typeof x === "string") {
          try {
            return JSON.parse(x);
          } catch {
            return null;
          }
        }
        return null;
      })
      .filter(Boolean);
  }, [order]);

  // Fetch images (and name fallback) from products table using product_id(s)
  useEffect(() => {
    if (!order) return;

    const productIds = items
      .map((it) => String((it as any)?.product_id ?? (it as any)?.productId ?? ""))
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
      <h1 className={styles.title}>Payment successful ✅</h1>
      <p className={styles.subtitle}>Thank you! Your order is being processed.</p>

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
          <p className={styles.muted}>We haven’t linked this payment to an order yet.</p>
        )}

        {!loading && !error && order && (
          <>
            <p className={styles.orderHeader}>
              Order <strong>{order.order_number ?? order.order_id}</strong> •{" "}
              <strong>{String(order.status ?? "").toUpperCase()}</strong>
            </p>

            <div className={styles.clientBox}>
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
            </div>

            {items.length > 0 && (
              <div className={styles.items}>
                {items.map((it, idx) => {
                  const anyIt = it as any;

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
