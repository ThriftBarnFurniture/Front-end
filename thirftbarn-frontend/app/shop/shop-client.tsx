"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./shop.module.css";
import { useSearchParams } from "next/navigation";
import {
  coerceEstateSaleCollectionValue,
  formatCollectionLabel,
  isEstateSaleCollection,
  isEstateSalePhotoCollection,
} from "@/lib/estate-sales";

type ProductUI = {
  id: string;
  name: string;
  quantity: number | null;

  category: string[];
  subcategory: string[];

  room_tags: string[];
  collections: string[];

  created_at: string;
  img: string | null;

  priceLabel: string;
  priceNumber: number;

  // ✅ NEW: for "price dropped" display
  initial_price: number | string | null;
};

type SortKey = "newest" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function normalizeFilterValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SearchParamsReader = {
  getAll: (name: string) => string[];
};

function getInitialFilterSelections(searchParams: SearchParamsReader) {
  const categories = searchParams.getAll("category");
  const collections = searchParams.getAll("collection");
  const estateSales = searchParams
    .getAll("estate")
    .map(coerceEstateSaleCollectionValue)
    .filter(Boolean);

  const regularCollections = collections.filter(
    (collection) => !isEstateSaleCollection(collection) && !isEstateSalePhotoCollection(collection)
  );
  const estateCollections = collections.filter(isEstateSaleCollection);

  return {
    categories,
    subcategories: categories.length > 0 ? searchParams.getAll("subcategory") : [],
    rooms: searchParams.getAll("room"),
    collections: regularCollections,
    estateSales: Array.from(new Set([...estateCollections, ...estateSales])),
  };
}

export default function ShopClient({ products }: { products: ProductUI[] }) {
  const searchParams = useSearchParams();
  const initialFilters = getInitialFilterSelections(searchParams);

  const [sort, setSort] = useState<SortKey>("newest");

  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    initialFilters.categories.map(normalizeFilterValue).filter(Boolean)
  );
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(() =>
    initialFilters.subcategories.map(normalizeFilterValue).filter(Boolean)
  );
  const [selectedRooms, setSelectedRooms] = useState<string[]>(() => initialFilters.rooms);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(() => initialFilters.collections);
  const [selectedEstateSales, setSelectedEstateSales] = useState<string[]>(() => initialFilters.estateSales);
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(() =>
    [
      initialFilters.categories.length,
      initialFilters.subcategories.length,
      initialFilters.rooms.length,
      initialFilters.collections.length,
      initialFilters.estateSales.length,
    ].some((count) => count > 0)
  );

  const options = useMemo(() => {
    const cats: string[] = [];
    const subs: string[] = [];
    const rooms: string[] = [];
    const cols: string[] = [];
    const estates: string[] = [];

    for (const p of products) {
      p.category.map(normalizeFilterValue).filter(Boolean).forEach((c) => cats.push(c));
      p.room_tags.forEach((r) => rooms.push(r));
      p.collections.forEach((c) => {
        if (isEstateSaleCollection(c)) estates.push(c);
        else if (isEstateSalePhotoCollection(c)) return;
        else cols.push(c);
      });

      const matchesSelectedCats =
        selectedCategories.length === 0 ||
        p.category.map(normalizeFilterValue).some((c) => selectedCategories.includes(c));

      if (matchesSelectedCats) {
        p.subcategory.map(normalizeFilterValue).filter(Boolean).forEach((s) => subs.push(s));
      }
    }

    return {
      categories: uniqueSorted(cats),
      subcategories: uniqueSorted(subs),
      rooms: uniqueSorted(rooms),
      collections: uniqueSorted(cols),
      estateSales: uniqueSorted(estates),
    };
  }, [products, selectedCategories]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const catOk =
        selectedCategories.length === 0 ||
        p.category.map(normalizeFilterValue).some((c) => selectedCategories.includes(c));

      const subOk =
        selectedSubcategories.length === 0 ||
        p.subcategory.map(normalizeFilterValue).some((s) => selectedSubcategories.includes(s));

      const roomOk =
        selectedRooms.length === 0 || p.room_tags.some((r) => selectedRooms.includes(r));

      const colOk =
        selectedCollections.length === 0 || p.collections.some((c) => selectedCollections.includes(c));

      const estateOk =
        selectedEstateSales.length === 0 || p.collections.some((c) => selectedEstateSales.includes(c));

      return catOk && subOk && roomOk && colOk && estateOk;
    });
  }, [products, selectedCategories, selectedSubcategories, selectedRooms, selectedCollections, selectedEstateSales]);

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
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return arr;
  }, [filtered, sort]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const toggleCategory = (category: string) => {
    const nextCategories = toggle(selectedCategories, category);
    setSelectedCategories(nextCategories);

    if (nextCategories.length === 0) {
      setSelectedSubcategories([]);
      return;
    }

    const allowedSubcategories = new Set<string>();
    for (const product of products) {
      if (product.category.map(normalizeFilterValue).some((c) => nextCategories.includes(c))) {
        product.subcategory
          .map(normalizeFilterValue)
          .filter(Boolean)
          .forEach((subcategory) => allowedSubcategories.add(subcategory));
      }
    }

    setSelectedSubcategories((prev) => prev.filter((subcategory) => allowedSubcategories.has(subcategory)));
  };

  const clearAll = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedRooms([]);
    setSelectedCollections([]);
    setSelectedEstateSales([]);
  };

  const activeFilterCount =
    selectedCategories.length +
    selectedSubcategories.length +
    selectedRooms.length +
    selectedCollections.length +
    selectedEstateSales.length;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>Filters</div>
          <div className={styles.sidebarActions}>
            <button
              type="button"
              className={styles.filterToggle}
              onClick={() => setFiltersExpanded((prev) => !prev)}
              aria-expanded={filtersExpanded}
              aria-controls="shop-filters-panel"
            >
              {filtersExpanded ? "Hide filters" : activeFilterCount > 0 ? `Show filters (${activeFilterCount})` : "Show filters"}
            </button>
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearAll}
              disabled={activeFilterCount === 0}
            >
              Clear
            </button>
          </div>
        </div>

        <div
          id="shop-filters-panel"
          className={[styles.filterPanel, filtersExpanded ? styles.filterPanelOpen : ""].join(" ")}
        >
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
                      onChange={() => toggleCategory(c)}
                    />
                    <span>{c}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className={styles.filterBlock}>
            {selectedCategories.length > 0 && (
              <>
                <div className={styles.filterTitle}>Subcategory</div>
                <div className={styles.filterList}>
                  {options.subcategories.length === 0 ? (
                    <div className={styles.muted}>No subcategories for selected categories.</div>
                  ) : (
                    options.subcategories.map((s) => (
                      <label key={s} className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={selectedSubcategories.includes(s)}
                          onChange={() => setSelectedSubcategories((prev) => toggle(prev, s))}
                        />
                        <span>{s}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
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
                      onChange={() => setSelectedCollections((prev) => toggle(prev, c))}
                    />
                    <span>{formatCollectionLabel(c)}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className={styles.filterBlock}>
            {options.estateSales.length > 0 && (
              <>
                <div className={styles.filterTitle}>Estate Sales</div>
                <div className={styles.filterList}>
                  {options.estateSales.map((c) => (
                    <label key={c} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={selectedEstateSales.includes(c)}
                        onChange={() => setSelectedEstateSales((prev) => toggle(prev, c))}
                      />
                      <span>{formatCollectionLabel(c)}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      <section className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.count}>
            Showing <strong>{sorted.length}</strong> of <strong>{products.length}</strong>
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
            {sorted.map((p) => {
              if (typeof p.quantity === "number" && p.quantity <= 0) return null;

              const initial =
                typeof p.initial_price === "string" ? Number(p.initial_price) : p.initial_price;

              const showDropped =
                Number.isFinite(initial) && p.priceNumber < (initial as number);

              return (
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

                    {typeof p.quantity === "number" && p.quantity <= 0 && <div className={styles.badge}>Sold</div>}
                  </div>

                  <div className={styles.meta}>
                    <div className={styles.name}>{p.name}</div>

                    {showDropped ? (
                      <div className={styles.priceRow}>
                        <span className={styles.oldPrice}>${(initial as number).toFixed(2)}</span>
                        <span className={styles.price}>${p.priceNumber.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className={styles.price}>{p.priceLabel}</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
