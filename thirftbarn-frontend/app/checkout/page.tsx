"use client";

import { useEffect, useState } from "react";
import styles from "./checkout.module.css";

type CartItem = { id: string; qty: number };

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const raw = localStorage.getItem("tbf_cart");
      const items: CartItem[] = raw ? JSON.parse(raw) : [];

      if (!items.length) {
        window.location.href = "/cart";
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      setLoading(false);
    };

    run();
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.h1}>Redirecting to Stripe…</h1>
        <p className={styles.sub}>
          {loading ? "Please wait." : "Something went wrong. Try again."}
        </p>
      </div>
    </main>
  );
}
