"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./shop.module.css";
import { useSearchParams } from "next/navigation";

type ProductUI = {
  id: string;
  name: string;
  quantity: number | null;

  category: string | null;
  subcategory: string | null;
  room_tags: string[];
  collections: string[];

  created_at: string;
  img: string | null;
  priceLabel: string;
  priceNumber: number;
};

type SortKey = "newest" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function ShopClient({ products }: { products: ProductUI[] }) {
  const [sort, setSort] = useState<SortKey>("newest");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  const options = useMemo(() => {
    const cats: string[] = [];
    const rooms: string[] = [];
    const cols: string[] = [];

    for (const p of products) {
      if (p.category) cats.push(p.category);
      p.room_tags.forEach((r) => rooms.push(r));
      p.collections.forEach((c) => cols.push(c));
    }

    return {
      categories: uniqueSorted(cats),
      rooms: uniqueSorted(rooms),
      collections: uniqueSorted(cols),
    };
  }, [products]);

  const searchParams = useSearchParams();

    useEffect(() => {
    const category = searchParams.get("category");
    const collection = searchParams.get("collection");
    const room = searchParams.get("room");

    if (category) setSelectedCategories([category]);
    if (collection) setSelectedCollections([collection]);
    if (room) setSelectedRooms([room]);
    }, [searchParams]);


  const filtered = useMemo(() => {
    return products.filter((p) => {
      const catOk =
        selectedCategories.length === 0 ||
        (p.category && selectedCategories.includes(p.category));

      const roomOk =
        selectedRooms.length === 0 || p.room_tags.some((r) => selectedRooms.includes(r));

      const colOk =
        selectedCollections.length === 0 ||
        p.collections.some((c) => selectedCollections.includes(c));

      return catOk && roomOk && colOk;
    });
  }, [products, selectedCategories, selectedRooms, selectedCollections]);

  const sorted = useMemo(() => {
    const arr = [...filtered];

    arr.sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return (a.priceNumber || 0) - (b.priceNumber || 0);
        case "price-desc":
          return (b.priceNumber || 0) - (a.priceNumber || 0);
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "newest":
        default:
            return (
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
      }
    });

    return arr;
  }, [filtered, sort]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const clearAll = () => {
    setSelectedCategories([]);
    setSelectedRooms([]);
    setSelectedCollections([]);
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>Filters</div>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={clearAll}
            disabled={
              selectedCategories.length === 0 &&
              selectedRooms.length === 0 &&
              selectedCollections.length === 0
            }
          >
            Clear
          </button>
        </div>

        <div className={styles.filterBlock}>
          <div className={styles.filterTitle}>Category</div>
          <div className={styles.filterList}>
            {options.categories.length === 0 ? (
              <div className={styles.muted}>No categories yet.</div>
            ) : (
              options.categories.map((c) => (
                <label key={c} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(c)}
                    onChange={() =>
                      setSelectedCategories((prev) => toggle(prev, c))
                    }
                  />
                  <span>{c}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className={styles.filterBlock}>
          <div className={styles.filterTitle}>Room</div>
          <div className={styles.filterList}>
            {options.rooms.length === 0 ? (
              <div className={styles.muted}>No room tags yet.</div>
            ) : (
              options.rooms.map((r) => (
                <label key={r} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={selectedRooms.includes(r)}
                    onChange={() => setSelectedRooms((prev) => toggle(prev, r))}
                  />
                  <span>{r}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className={styles.filterBlock}>
          <div className={styles.filterTitle}>Collections</div>
          <div className={styles.filterList}>
            {options.collections.length === 0 ? (
              <div className={styles.muted}>No collections yet.</div>
            ) : (
              options.collections.map((c) => (
                <label key={c} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(c)}
                    onChange={() =>
                      setSelectedCollections((prev) => toggle(prev, c))
                    }
                  />
                  <span>{c}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.count}>
            Showing <strong>{sorted.length}</strong> of{" "}
            <strong>{products.length}</strong>
          </div>

          <div className={styles.sortWrap}>
            <label className={styles.sortLabel}>Sort by</label>
            <select
              className={styles.sortSelect}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low → high</option>
              <option value="price-desc">Price: high → low</option>
              <option value="name-asc">Name: A → Z</option>
              <option value="name-desc">Name: Z → A</option>
            </select>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className={styles.empty}>No products match these filters.</p>
        ) : (
          <div className={styles.grid}>
            {sorted.map((p) => (
              <Link key={p.id} href={`/item/${p.id}`} className={styles.card}>
                <div className={styles.imageWrap}>
                  {p.img ? (
                    <Image
                      src={p.img}
                      alt={p.name}
                      fill
                      className={styles.image}
                      sizes="(max-width: 900px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    />
                  ) : (
                    <div className={styles.noImage}>No image</div>
                  )}

                  {p.quantity !== null && p.quantity <= 0 && (
                    <div className={styles.badge}>Sold</div>
                  )}
                </div>

                <div className={styles.meta}>
                  <div className={styles.name}>{p.name}</div>
                  <div className={styles.price}>{p.priceLabel}</div>
                </div>

                {p.category && <div className={styles.sub}>{p.category}</div>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
