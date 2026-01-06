"use client";

import { useEffect, useState } from "react";
import styles from "./cart.module.css";
import Link from "next/link";

type CartItem = { id: string; qty: number };

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("tbf_cart");
    setItems(raw ? JSON.parse(raw) : []);
  }, []);

  const remove = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    localStorage.setItem("tbf_cart", JSON.stringify(next));
  };

  return (
    <main className={styles.page}>
      <section className={styles.wrap}>
        <h1 className={styles.h1}>Cart</h1>

        {items.length === 0 ? (
          <p className={styles.sub}>
            Your cart is empty. <Link href="/shop">Go shopping →</Link>
          </p>
        ) : (
          <>
            <ul className={styles.list}>
              {items.map((i) => (
                <li key={i.id} className={styles.row}>
                  <div>
                    <div className={styles.itemId}>{i.id}</div>
                    <div className={styles.qty}>Qty: {i.qty}</div>
                  </div>
                  <button className={styles.remove} onClick={() => remove(i.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <Link className={styles.primary} href="/checkout">
              Checkout →
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
