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

      router.push("/checkout");
    } catch {
      setWarning("An item in your cart is out of stock, please remove to continue with purchase.");
    } finally {
      setCheckingOut(false);
    }
  };

  const [stockById, setStockById] = useState<Record<string, number | null>>({});

  //Update cart page so Qty input clamps to available stock
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

  //auto-fix cart if stock drops while cart is open
  useEffect(() => {
    if (!items.length) return;

    for (const it of items) {
      const stock = stockById[it.productId];
      if (typeof stock !== "number") continue;

      const max = Math.max(stock, 0);
      if (it.quantity > max) setQty(it.productId, Math.max(1, max));
    }
  }, [stockById, items, setQty]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your Cart</h1>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p>Your cart is empty.</p>
          <button className={styles.primary} onClick={() => router.push("/shop")}>
            Go to Shop
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.list}>
            {items.map((it) => (
              <div key={it.productId} className={styles.row}>
                <div className={styles.imgWrap}>
                  {it.imageUrl ? (
                    <Image
                      src={it.imageUrl}
                      alt={it.name}
                      fill
                      className={styles.img}
                      sizes="80px"
                    />
                  ) : (
                    <div className={styles.imgFallback} />
                  )}
                </div>

                <div className={styles.info}>
                  <div className={styles.name}>{it.name}</div>
                  <div className={styles.price}>${it.price.toFixed(2)}</div>

                  <div className={styles.controls}>
                    <label className={styles.qtyLabel}>
                      Qty
                      <input
                        className={styles.qty}
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          const next = Number.isFinite(raw) ? Math.floor(raw) : 1;

                          const stock = stockById[it.productId]; // number | null | undefined
                          const max = typeof stock === "number" ? Math.max(stock, 0) : Infinity;

                          const clamped = Math.max(1, Math.min(next, max));
                          setQty(it.productId, clamped);
                        }}
                      />
                    </label>

                    <button className={styles.link} onClick={() => removeItem(it.productId)}>
                      Remove
                    </button>
                  </div>
                </div>

                <div className={styles.lineTotal}>${(it.price * it.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className={styles.summary}>
            <h2>Summary</h2>

            {warning && (
              <div style={{ marginBottom: "12px" }}>
                {warning}
              </div>
            )}

            <div className={styles.sumRow}>
              <span>Items</span>
              <span>{totalItems}</span>
            </div>
            <div className={styles.sumRow}>
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <button className={styles.primary} onClick={checkout} disabled={checkingOut}>
              {checkingOut ? "Checking..." : "Checkout"}
            </button>

            <button className={styles.secondary} onClick={clear} disabled={checkingOut}>
              Clear Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
