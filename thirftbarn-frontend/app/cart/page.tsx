"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import styles from "./cart.module.css";
import { useEffect, useMemo, useState } from "react";

const STORE_ADDRESS = "2786 ON-34  Hawkesbury, ON K6A 2R2";

// Pricing rules
const OVERWEIGHT_FEE = 135;
const TIER_1_MAX_KM = 49;
const TIER_2_MAX_KM = 200;

const PRICES = {
  tier1: { delivery_drop: 17.5, inhouse_drop: 45 },
  tier2: { delivery_drop: 55, inhouse_drop: 115 },
} as const;

type ShippingMethod = "" | "pickup" | "delivery_drop" | "inhouse_drop";

function computeBaseShippingFromKm(method: "delivery_drop" | "inhouse_drop", km: number) {
  if (km <= TIER_1_MAX_KM) {
    return method === "delivery_drop" ? PRICES.tier1.delivery_drop : PRICES.tier1.inhouse_drop;
  }
  if (km <= TIER_2_MAX_KM) {
    return method === "delivery_drop" ? PRICES.tier2.delivery_drop : PRICES.tier2.inhouse_drop;
  }
  return 0;
}

function formatKm(km: number) {
  if (!isFinite(km) || km <= 0) return "—";
  return `${km.toFixed(1)} km`;
}

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, totalItems, removeItem, setQty, clear } = useCart();

  const [warning, setWarning] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Shipping selection + address to estimate tiers
  const [shipping, setShipping] = useState<ShippingMethod>("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("Canada");

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  // Existing promo bits (kept, but still not used in cart totals like your current UI says)
  const [promoInput, setPromoInput] = useState<string>("");
  const [appliedPromo, setAppliedPromo] = useState<string>("");

  const [stockById, setStockById] = useState<Record<string, number | null>>({});

  const needsAddress = shipping === "delivery_drop" || shipping === "inhouse_drop";
  const mergedAddress = useMemo(() => {
    if (!needsAddress) return "";
    const parts = [street.trim(), city.trim(), region.trim(), postal.trim(), country.trim()].filter(Boolean);
    return parts.join(", ");
  }, [needsAddress, street, city, region, postal, country]);

  const isOverweightCart = useMemo(() => items.some((it: any) => Boolean(it?.is_oversized)), [items]);

  // Update cart page so Qty input clamps to available stock
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/cart/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: items.map((i) => i.productId) }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { stock: Record<string, number | null> };
        setStockById(data.stock || {});
      } catch {
        // ignore — cart still works, just won't cap
      }
    };

    if (items.length) load();
    else setStockById({});
  }, [items]);

  // Auto-fix cart if stock drops while cart is open
  useEffect(() => {
    if (!items.length) return;

    for (const it of items) {
      const stock = stockById[it.productId];
      if (typeof stock !== "number") continue;

      const max = Math.max(stock, 0);
      if (it.quantity > max) setQty(it.productId, Math.max(1, max));
    }
  }, [stockById, items, setQty]);

  const clampQty = (productId: string, next: number) => {
    const stock = stockById[productId]; // number | null | undefined
    const max = typeof stock === "number" ? Math.max(stock, 0) : Infinity;
    return Math.max(1, Math.min(Math.floor(next || 1), max));
  };

  // Distance estimate (matches checkout/server logic via /api/shipping/distance)
  useEffect(() => {
    const shouldLookup =
      needsAddress && street.trim() && city.trim() && region.trim() && postal.trim() && country.trim();

    if (!shouldLookup) {
      setDistanceKm(null);
      setDistanceError(null);
      setDistanceLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setDistanceLoading(true);
      setDistanceError(null);

      try {
        const res = await fetch("/api/shipping/distance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            origin: STORE_ADDRESS,
            destination: mergedAddress,
          }),
        });

        const contentType = res.headers.get("content-type") || "";
        const data = contentType.includes("application/json") ? await res.json().catch(() => ({})) : null;

        if (!res.ok) {
          const text = data ? (data as any).error : await res.text();
          throw new Error(text || "Distance lookup failed.");
        }

        const km = Number((data as any)?.distance_km);
        if (!isFinite(km) || km <= 0) throw new Error("Distance lookup returned an invalid distance.");

        if (cancelled) return;
        setDistanceKm(km);

        // If 200km+, we don't allow selecting delivery/inhouse (quote only)
        if (km > TIER_2_MAX_KM) {
          setShipping(""); // force user to pick up or see quote message
        }
      } catch (e: any) {
        if (cancelled) return;
        setDistanceKm(null);
        setDistanceError(e?.message ?? "Distance lookup failed.");
      } finally {
        if (!cancelled) setDistanceLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [needsAddress, street, city, region, postal, country, mergedAddress]);

  const quoteRequired = useMemo(() => {
    if (!needsAddress) return false;
    if (distanceKm != null && distanceKm > TIER_2_MAX_KM) return true;
    return false;
  }, [needsAddress, distanceKm]);

  const estimatedShippingCost = useMemo(() => {
    if (shipping === "pickup") return 0;
    if (!needsAddress) return 0;

    if (!distanceKm || distanceKm <= 0) return 0;
    if (distanceKm > TIER_2_MAX_KM) return 0;

    const base = computeBaseShippingFromKm(shipping, distanceKm);
    const overweight = isOverweightCart ? OVERWEIGHT_FEE : 0;
    return Math.max(0, base + overweight);
  }, [shipping, needsAddress, distanceKm, isOverweightCart]);

  const estimateText = useMemo(() => {
    if (shipping === "pickup") return "Pickup is free. Held 21 days before forfeiture.";
    if (!needsAddress) return "Select a shipping option.";
    if (distanceLoading) return "Calculating distance-based shipping…";
    if (distanceError) return `Shipping estimate error: ${distanceError}`;
    if (!mergedAddress) return "Enter your full address to calculate shipping.";
    if (!distanceKm) return "Enter your full address to calculate shipping.";
    if (distanceKm > TIER_2_MAX_KM) return "200km+ from the store — email for a case-specific quote.";
    const base = computeBaseShippingFromKm(shipping, distanceKm);
    const overweight = isOverweightCart ? OVERWEIGHT_FEE : 0;
    const total = base + overweight;
    return `Distance: ${formatKm(distanceKm)} • Base: $${base.toFixed(2)}${
      overweight ? ` • Overweight fee: $${overweight.toFixed(2)}` : ""
    } • Estimated: $${total.toFixed(2)}`;
  }, [shipping, needsAddress, distanceLoading, distanceError, mergedAddress, distanceKm, isOverweightCart]);

  const checkout = async () => {
    setWarning(null);
    setCheckingOut(true);

    try {
      const res = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: items.map((i) => i.productId) }),
      });

      if (!res.ok) throw new Error("Validation failed.");

      const data = (await res.json()) as {
        ok: boolean;
        outOfStock: { id: string; name: string }[];
      };

      if (!data.ok) {
        setWarning("An item in your cart is out of stock, please remove to continue with purchase.");
        return;
      }

      // If user chose delivery/inhouse but it's 200km+, block cart->checkout
      if (quoteRequired) {
        setWarning("This address is 200km+ away. Please email for a case-specific quote before purchasing.");
        return;
      }

      router.push("/checkout");
    } catch {
      setWarning("An item in your cart is out of stock, please remove to continue with purchase.");
    } finally {
      setCheckingOut(false);
    }
  };

  // Keep your existing promo behavior (not used in totals here)
  const promoDiscount = useMemo(() => {
    const code = appliedPromo.trim().toUpperCase();
    if (!code) return 0;
    if (code === "BVGSFSRSE") return 10;
    return 0;
  }, [appliedPromo]);

  const taxableBase = Math.max(0, subtotal /* + estimatedShippingCost - promoDiscount */);
  const taxes = 0;
  const totalCost = Math.max(0, taxableBase + taxes);

  return (
    <main className={styles.page}>
      {items.length === 0 ? (
        <div className={styles.empty}>
          <h1 className={styles.emptyTitle}>Your Cart is Empty</h1>
          <button className={styles.checkoutBtn} onClick={() => router.push("/shop")}>
            Go to Shop
          </button>
        </div>
      ) : (
        <div className={styles.shell}>
          {/* LEFT */}
          <section className={styles.left}>
            <div className={styles.leftHead}>
              <h1 className={styles.title}>Your Cart</h1>
              <div className={styles.itemsCount}>{totalItems} Items</div>
            </div>

            <div className={styles.hr} />

            <div className={styles.list}>
              {items.map((it: any) => {
                const maxStock =
                  typeof stockById[it.productId] === "number"
                    ? Math.max(stockById[it.productId] as number, 0)
                    : null;

                return (
                  <div key={it.productId} className={styles.row}>
                    <div className={styles.photo}>
                      {it.imageUrl ? (
                        <Image src={it.imageUrl} alt={it.name} fill className={styles.img} sizes="110px" />
                      ) : (
                        <div className={styles.photoFallback}>PHOTO</div>
                      )}
                    </div>

                    <div className={styles.rowMid}>
                      <div className={styles.name}>{it.name}</div>
                      {it?.is_oversized ? <div className={styles.stockNote}>Oversized item</div> : null}

                      <div className={styles.rowControls}>
                        {/* Qty UI */}
                        <div className={styles.qtyWrap} aria-label="Quantity selector">
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() => setQty(it.productId, clampQty(it.productId, it.quantity - 1))}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>

                          <input
                            className={styles.qtyInput}
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={it.quantity}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              setQty(it.productId, clampQty(it.productId, raw));
                            }}
                            aria-label="Quantity"
                          />

                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() => setQty(it.productId, clampQty(it.productId, it.quantity + 1))}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Optional stock hint */}
                        {typeof maxStock === "number" ? <div className={styles.stockNote}>Max {maxStock}</div> : null}

                        <button className={styles.remove} onClick={() => removeItem(it.productId)}>
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className={styles.rowRight}>
                      <div className={styles.lineTotal}>${(it.price * it.quantity).toFixed(2)}</div>
                      <div className={styles.unitPrice}>${it.price.toFixed(2)} each</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.bottomHr} />

            <button className={styles.continue} onClick={() => router.push("/shop")} type="button">
              <span className={styles.arrow}>←</span> Continue Shopping
            </button>
          </section>

          {/* RIGHT */}
          <aside className={styles.right}>
            <div className={styles.summaryCard}>
              <h2 className={styles.summaryTitle}>Order Summary</h2>
              <div className={styles.hr} />

              {warning && <div className={styles.warning}>{warning}</div>}

              {/* Shipping selector + estimate (cart-level) */}
              <div className={styles.calc}>

                {/* Price calculation (keep your existing messaging; now we show estimate only) */}
                <div className={styles.calcRow}>
                  <span>Items Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                <div className={styles.calcRow}>
                  <span>Taxes</span>
                  <span>${taxes.toFixed(2)}</span>
                </div>

                <div className={styles.calcRow}>
                  <span className={styles.muted}>
                    Promo and shipping calculated at checkout
                  </span>
                </div>
              </div>

              <div className={styles.hr} />

              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>TOTAL COST</span>
                <span className={styles.totalValue}>${totalCost.toFixed(2)}</span>
              </div>

              <button className={styles.checkoutBtn} onClick={checkout} disabled={checkingOut} type="button">
                {checkingOut ? "Checking..." : "Checkout"}
              </button>

              {/* keep functionality but hidden */}
              <button className={styles.hiddenClear} onClick={clear} disabled={checkingOut} type="button">
                Clear Cart
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
