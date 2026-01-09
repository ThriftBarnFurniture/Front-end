"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import styles from "./cart.module.css";

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, totalItems, removeItem, setQty, clear } = useCart();

  const checkout = async () => {
    const payload = {
      items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
    };

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(`Checkout failed: ${msg}`);
      return;
    }

    const data = (await res.json()) as { url: string };
    router.push(data.url);
  };

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
                        onChange={(e) => setQty(it.productId, Number(e.target.value))}
                      />
                    </label>

                    <button className={styles.link} onClick={() => removeItem(it.productId)}>
                      Remove
                    </button>
                  </div>
                </div>

                <div className={styles.lineTotal}>
                  ${(it.price * it.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.summary}>
            <h2>Summary</h2>
            <div className={styles.sumRow}>
              <span>Items</span>
              <span>{totalItems}</span>
            </div>
            <div className={styles.sumRow}>
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <button className={styles.primary} onClick={checkout}>
              Checkout
            </button>

            <button className={styles.secondary} onClick={clear}>
              Clear Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
