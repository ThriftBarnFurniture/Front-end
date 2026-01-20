// components/nav/shopmenu.tsx
"use client";

import Link from "next/link";
import styles from "./shop-menu.module.css";
import { SHOP_TAXONOMY } from "@/lib/taxonomy";

export default function ShopMenu({ onClose }: { onClose?: () => void }) {
  return (
    <div className={styles.wrap} aria-label="Shop menu" onClickCapture={(e) => {
        // If any <a> inside is clicked, close immediately
        const target = e.target as HTMLElement | null;
        if (target?.closest("a")) onClose?.();
      }}>
      <div className={styles.panel}>
        <div className={styles.grid}>
          {SHOP_TAXONOMY.map((cat) => (
            <div key={cat.slug} className={styles.col}>
              <Link
                className={styles.cat}
                href={`/shop?category=${encodeURIComponent(cat.slug)}`}
              >
                {cat.label}
              </Link>

              <ul className={styles.list}>
                {cat.sub.map((s) => (
                  <li key={s.slug} className={styles.item}>
                    <Link
                      className={styles.sub}
                      href={`/shop?category=${encodeURIComponent(
                        cat.slug
                      )}&subcategory=${encodeURIComponent(s.slug)}`}
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottomRow}>
          <Link className={styles.allLink} href="/shop?sort=newest">
            View all (Newest)
          </Link>
        </div>
      </div>
    </div>
  );
}
