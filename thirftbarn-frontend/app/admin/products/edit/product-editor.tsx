"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./product-editor.module.css";

type Product = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  colors?: string[] | null;
  image_url?: string | null;
  image_urls?: string[] | null;
};

export function ProductEditor({ initialProducts }: { initialProducts: Product[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return initialProducts;

    const queryNum = Number(query);
    const hasNum = !Number.isNaN(queryNum);

    return initialProducts.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const category = (p.category ?? "").toLowerCase();
      const colors = (p.colors ?? []).join(" ").toLowerCase();
      const priceStr = String(p.price ?? "");

      const matchText = name.includes(query) || category.includes(query) || colors.includes(query);
      const matchPrice = (hasNum && Number(p.price) === queryNum) || priceStr.includes(query);

      return matchText || matchPrice;
    });
  }, [q, initialProducts]);

  return (
    <div className={styles.wrap}>
      <div className={styles.searchRow}>
        <input
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, price, colors, or category…"
        />
      </div>

      <div className={styles.meta}>
        <span>{filtered.length} result(s)</span>
      </div>

      <div className={styles.list}>
        {filtered.map((p) => {
          const thumb = p.image_url || p.image_urls?.[0] || "";

          return (
            <div
              key={p.id}
              className={styles.row}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/admin/products/edit/${p.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") router.push(`/admin/products/edit/${p.id}`);
              }}
              style={{ cursor: "pointer" }}
              aria-label={`Edit ${p.name}`}
            >
              <div className={styles.thumb}>
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={p.name} />
                ) : (
                  <div className={styles.noThumb}>No image</div>
                )}
              </div>

              <div className={styles.info}>
                <div className={styles.topLine}>
                  <div className={styles.name}>{p.name}</div>
                  <div className={styles.price}>${Number(p.price).toFixed(2)}</div>
                </div>

                <div className={styles.subLine}>
                  <span className={styles.pill}>{p.category || "Uncategorized"}</span>
                  {(p.colors ?? []).slice(0, 4).map((c) => (
                    <span key={c} className={styles.pillMuted}>
                      {c}
                    </span>
                  ))}
                </div>

                <div className={styles.idLine}>
                  <span className={styles.idLabel}>ID:</span>
                  <code className={styles.id}>{p.id}</code>
                </div>
              </div>

              <button
                className={styles.copyBtn}
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // IMPORTANT: don't open editor when copying
                  navigator.clipboard.writeText(p.id);
                }}
              >
                Copy ID
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
