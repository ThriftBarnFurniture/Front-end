"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "./shop.module.css";

export type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  is_active: boolean;
  updated_at: string;
};

function formatMoney(cents: number, currency: string) {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

export default function ShopClient({ initialProducts }: { initialProducts: Product[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>(initialProducts);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    const channel = supabase
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          const { eventType } = payload;

          if (eventType === "INSERT") {
            const p = payload.new as Product;
            if (!p.is_active) return;
            setProducts((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
          }

          if (eventType === "UPDATE") {
            const p = payload.new as Product;
            setProducts((prev) => {
              const next = prev.filter((x) => x.id !== p.id);
              return p.is_active ? [p, ...next] : next;
            });
          }

          if (eventType === "DELETE") {
            const p = payload.old as Product;
            setProducts((prev) => prev.filter((x) => x.id !== p.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const addToCart = (product: Product) => {
    const raw = localStorage.getItem("tbf_cart");
    const cart: { id: string; qty: number }[] = raw ? JSON.parse(raw) : [];

    const existing = cart.find((c) => c.id === product.id);
    if (existing) existing.qty += 1;
    else cart.push({ id: product.id, qty: 1 });

    localStorage.setItem("tbf_cart", JSON.stringify(cart));
    alert("Added to cart!");
  };

  return (
    <div className={styles.grid}>
      {products.map((p) => (
        <article key={p.id} className={styles.productCard}>
          <div className={styles.productImage}>
            {p.image_url ? (
              <Image
                src={p.image_url}
                alt={p.name}
                fill
                className={styles.img}
                sizes="(max-width: 800px) 100vw, 33vw"
              />
            ) : (
              <div className={styles.imgFallback}>No image</div>
            )}
          </div>

          <div className={styles.productBody}>
            <div className={styles.row}>
              <h2 className={styles.productName}>{p.name}</h2>
              <div className={styles.price}>
                {formatMoney(p.price_cents, p.currency)}
              </div>
            </div>

            <p className={styles.desc}>{p.description}</p>

            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={() => addToCart(p)}>
                Add to cart
              </button>
              <Link className={styles.ghostBtn} href="/cart">
                View cart
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
