"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import styles from "./cart.module.css";
import { useEffect, useMemo, useState } from "react";

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, totalItems, removeItem, setQty, clear } = useCart();

  const [warning, setWarning] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // UI + calculations
  const [shipping, setShipping] = useState<string>("");
  const [promoInput, setPromoInput] = useState<string>("");
  const [appliedPromo, setAppliedPromo] = useState<string>("");

  // NEW: postal code shown when shipping === "shipping" (NOT required to proceed)
  const [postalCode, setPostalCode] = useState<string>("");


  const [stockById, setStockById] = useState<Record<string, number | null>>({});

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
        setWarning(
          "An item in your cart is out of stock, please remove to continue with purchase."
        );
        return;
      }

      // (Optional later) you’ll likely store shipping + address in your CartProvider or session.
      router.push("/checkout");
    } catch {
      setWarning(
        "An item in your cart is out of stock, please remove to continue with purchase."
      );
    } finally {
      setCheckingOut(false);
    }
  };

  // Simple promo behavior for now:
  // - Apply only when user hits "Apply"
  // - Example: BVGSFSRSE = $10 off
  const promoDiscount = useMemo(() => {
    const code = appliedPromo.trim().toUpperCase();
    if (!code) return 0;
    if (code === "BVGSFSRSE") return 10;
    return 0; // unknown code = 0 for now (we can wire backend later)
  }, [appliedPromo]);

  const shippingCost = useMemo(() => {
    if (shipping === "pickup") return 0;

    if (shipping === "shipping") {
      // Simple postal code pricing (Canada).
      // You can adjust these rules any time.
      const pc = postalCode.toUpperCase().replace(/\s+/g, "");

      if (!pc) return 0; // no postal code yet = show $0 for now

      // Ontario (K, L, M, N, P) - example: cheaper
      if (/^[KLMNP]/.test(pc)) return 15;

      // Quebec (H, J, G) - example: medium
      if (/^[HJG]/.test(pc)) return 20;

      // Everything else - example: higher
      return 30;
    }

    return 0;
  }, [shipping, postalCode]);

  const taxableBase = Math.max(0, subtotal + shippingCost - promoDiscount);
  const taxes = 0; // wire later
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
              {items.map((it) => {
                const maxStock =
                  typeof stockById[it.productId] === "number"
                    ? Math.max(stockById[it.productId] as number, 0)
                    : null;

                return (
                  <div key={it.productId} className={styles.row}>
                    <div className={styles.photo}>
                      {it.imageUrl ? (
                        <Image
                          src={it.imageUrl}
                          alt={it.name}
                          fill
                          className={styles.img}
                          sizes="110px"
                        />
                      ) : (
                        <div className={styles.photoFallback}>PHOTO</div>
                      )}
                    </div>

                    <div className={styles.rowMid}>
                      <div className={styles.name}>{it.name}</div>

                      <div className={styles.rowControls}>
                        {/* Qty UI */}
                        <div className={styles.qtyWrap} aria-label="Quantity selector">
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() =>
                              setQty(it.productId, clampQty(it.productId, it.quantity - 1))
                            }
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
                            onClick={() =>
                              setQty(it.productId, clampQty(it.productId, it.quantity + 1))
                            }
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Optional stock hint */}
                        {typeof maxStock === "number" ? (
                          <div className={styles.stockNote}>Max {maxStock}</div>
                        ) : null}

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

              
              {/* Price calculation */}
              <div className={styles.calc}>
                <div className={styles.calcRow}>
                  <span>Promo & Shipping Calculated at checkout</span>
                </div>

                <div className={styles.calcRow}>
                  <span>Items Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                <div className={styles.calcRow}>
                  <span>Taxes</span>
                  <span>${taxes.toFixed(2)}</span>
                </div>
              </div>

              <div className={styles.hr} />

              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>TOTAL COST</span>
                <span className={styles.totalValue}>${totalCost.toFixed(2)}</span>
              </div>

              <button
                className={styles.checkoutBtn}
                onClick={checkout}
                disabled={checkingOut}
                type="button"
              >
                {checkingOut ? "Checking..." : "Checkout"}
              </button>

              {/* keep functionality but hidden */}
              <button
                className={styles.hiddenClear}
                onClick={clear}
                disabled={checkingOut}
                type="button"
              >
                Clear Cart
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
