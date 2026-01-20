"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type CategoryValue =
  | "seating"
  | "tables"
  | "shelves"
  | "storage"
  | "lighting"
  | "decor"
  | "tools-equipment"
  | "electronics"
  | "musical-instruments"
  | "bags";

const CATEGORY_OPTIONS: { value: CategoryValue; label: string }[] = [
  { value: "seating", label: "Seating" },
  { value: "tables", label: "Tables" },
  { value: "shelves", label: "Shelves" },
  { value: "storage", label: "Storage" },
  { value: "lighting", label: "Lighting" },
  { value: "decor", label: "Decor" },
  { value: "tools-equipment", label: "Tools / Equipment" },
  { value: "electronics", label: "Electronics" },
  { value: "musical-instruments", label: "Musical Instruments" },
  { value: "bags", label: "Bags" },
];

const SUBCATEGORY_MAP: Record<CategoryValue, { value: string; label: string }[]> = {
  seating: [
    { value: "sofa", label: "Sofa" },
    { value: "armchair", label: "Armchair" },
    { value: "dining-chair", label: "Dining Chair" },
    { value: "stool", label: "Stool" },
    { value: "bench", label: "Bench" },
  ],
  tables: [
    { value: "dining-table", label: "Dining Table" },
    { value: "coffee-table", label: "Coffee Table" },
    { value: "side-table", label: "Side Table" },
    { value: "desk", label: "Desk" },
  ],
  shelves: [
    { value: "bookshelf", label: "Bookshelf" },
    { value: "wall-shelf", label: "Wall Shelf" },
    { value: "cube-shelf", label: "Cube Shelf" },
  ],
  storage: [
    { value: "dresser", label: "Dresser" },
    { value: "bookshelf", label: "Bookshelf" },
    { value: "cabinet", label: "Cabinet" },
    { value: "sideboard", label: "Sideboard" },
    { value: "tv-stand", label: "TV Stand" },
  ],
  lighting: [
    { value: "lamp", label: "Lamp" },
    { value: "floor-lamp", label: "Floor Lamp" },
    { value: "ceiling-light", label: "Ceiling Light" },
  ],
  decor: [
    { value: "art", label: "Art" },
    { value: "frames", label: "Frames" },
    { value: "vase", label: "Vase" },
    { value: "collectibles", label: "Collectibles" },
  ],
  "tools-equipment": [
    { value: "tool", label: "Tool" },
    { value: "storage", label: "Storage" },
    { value: "lawnmower", label: "Lawnmower" },
  ],
  electronics: [
    { value: "tv", label: "TV" },
    { value: "audio", label: "Audio" },
  ],
  "musical-instruments": [
    { value: "piano", label: "Piano" },
    { value: "guitar", label: "Guitar" },
  ],
  bags: [
    { value: "luggage", label: "Luggage" },
    { value: "backpack", label: "Backpack" },
    { value: "handbag", label: "Handbag" },
  ],
};

const ROOM_TAGS = [
  { value: "living-room", label: "Living Room" },
  { value: "dining-room", label: "Dining Room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "office", label: "Office" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "kids-room", label: "Kids Room" },
  { value: "garage", label: "Garage" },
  { value: "outdoor", label: "Outdoor" },
] as const;

const COLLECTIONS = [
  { value: "5$ and Under", label: "5$ and Under" },
  { value: "Seasonal", label: "Seasonal" },
  { value: "Vintage", label: "Vintage" },
  { value: "Kids-Zone", label: "Kids-Zone" },
] as const;

const CONDITION_OPTIONS = [
  { value: "New", label: "New" },
  { value: "Like New", label: "Like New" },
  { value: "Used", label: "Used" },
  { value: "Heavily Used", label: "Heavily Used" },
  { value: "Damaged", label: "Damaged" },
] as const;

const COLOR_OPTIONS = [
  "Black",
  "White",
  "Gray",
  "Silver",
  "Gold",
  "Beige",
  "Cream",
  "Brown",
  "Tan",
  "Natural Wood",
  "Oak",
  "Walnut",
  "Cherry",
  "Pine",
  "Mahogany",
  "Blue",
  "Navy",
  "Teal",
  "Green",
  "Olive",
  "Red",
  "Burgundy",
  "Pink",
  "Purple",
  "Yellow",
  "Orange",
  "Clear/Glass",
  "Transparent",
  "Multicolor",
  "Brass",
  "Copper",
  "Chrome",
] as const;

// helper: safe multi-select getter from DOM
function getSelectedValues(select: HTMLSelectElement) {
  return Array.from(select.selectedOptions).map((o) => o.value).filter(Boolean);
}

export const ProductForm = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // still supported (for PATCH), but hidden now
  const [productId, setProductId] = useState("");

  const [category, setCategory] = useState<CategoryValue | "">("");
  const [subcategory, setSubcategory] = useState("");

  const subcategories = useMemo(() => {
    if (!category) return [];
    return SUBCATEGORY_MAP[category] ?? [];
  }, [category]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    setStatus(null);
    setIsSubmitting(true);

    const formData = new FormData(form);

    // Keep state-driven category/subcategory reliable
    if (category) formData.set("category", category);
    else formData.set("category", "");

    formData.set("subcategory", subcategory || "");

    // Convert multi-selects to repeated keys (text[])
    const roomSel = form.querySelector<HTMLSelectElement>("#room_tags");
    const collSel = form.querySelector<HTMLSelectElement>("#collections");
    const colorSel = form.querySelector<HTMLSelectElement>("#colors");

    formData.delete("room_tags");
    formData.delete("collections");
    formData.delete("colors");

    (roomSel ? getSelectedValues(roomSel) : []).forEach((v) => formData.append("room_tags", v));
    (collSel ? getSelectedValues(collSel) : []).forEach((v) => formData.append("collections", v));
    (colorSel ? getSelectedValues(colorSel) : []).forEach((v) => formData.append("colors", v));

    const selectedProductId = String(formData.get("productId") ?? "").trim();
    const method = selectedProductId ? "PATCH" : "POST";

    try {
      const response = await fetch("/api/admin/products", {
        method,
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const errorMessage =
          typeof payload === "string"
            ? payload || "Unable to save product."
            : payload?.error ?? "Unable to save product.";
        throw new Error(errorMessage);
      }

      form.reset();
      setProductId("");
      setCategory("");
      setSubcategory("");
      setStatus("Product saved successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {/* Hidden productId for updates only */}
      <input type="hidden" name="productId" value={productId} />

      {/* If you still want a way to update: you can temporarily expose this elsewhere,
          or keep it hidden and set it from your edit page later. */}

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="name">
          Product name *
        </label>
        <input className={styles.input} id="name" name="name" type="text" required />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="quantity">
          Quantity *
        </label>
        <input className={styles.input} id="quantity" name="quantity" type="number" step="1" min="0" required />
      </div>

      {/* ✅ PRICE required because DB has NOT NULL */}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="price">
          Price (CAD) *
        </label>
        <input
          className={styles.input}
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </div>

      {/* Category same look as subcategory (select) */}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="category">
          Category *
        </label>
        <select
          className={styles.input}
          id="category"
          name="category"
          value={category}
          onChange={(e) => {
            const v = e.target.value as CategoryValue | "";
            setCategory(v);
            setSubcategory("");
          }}
          required
        >
          <option value="" disabled>
            Select…
          </option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Subcategory conditional */}
      {category && (
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="subcategory">
            Subcategory
          </label>
          <select
            className={styles.input}
            id="subcategory"
            name="subcategory"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
          >
            <option value="">(none)</option>
            {subcategories.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Room tags dropdown (multi-select) */}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="room_tags">
          Room tags
        </label>
        <select className={styles.input} id="room_tags" name="room_tags" multiple size={5}>
          {ROOM_TAGS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className={styles.status}>Tip: hold Ctrl (Windows) / Cmd (Mac) to select multiple.</p>
      </div>

      {/* Collections dropdown (multi-select) */}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="collections">
          Collections
        </label>
        <select className={styles.input} id="collections" name="collections" multiple size={4}>
          {COLLECTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Colors dropdown (multi-select) - REQUIRED */}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="colors">
          Colors *
        </label>
        <select className={styles.input} id="colors" name="colors" multiple size={6} required>
          {COLOR_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className={styles.status}>Select one or more colors.</p>
      </div>

      {/* Dimensions with inches */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Dimensions (inches)</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <input className={styles.input} name="height" type="number" step="0.01" min="0" placeholder='Height (")' />
          <input className={styles.input} name="width" type="number" step="0.01" min="0" placeholder='Width (")' />
          <input className={styles.input} name="depth" type="number" step="0.01" min="0" placeholder='Depth (")' />
        </div>
      </div>

      {/* Condition REQUIRED */}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="condition">
          Condition *
        </label>
        <select className={styles.input} id="condition" name="condition" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          {CONDITION_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Description REQUIRED */}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="description">
          Description *
        </label>
        <textarea className={styles.textarea} id="description" name="description" rows={6} required />
      </div>

      {/* Photos REQUIRED - no max */}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="images">
          Photos * (no max)
        </label>
        <input className={styles.input} id="images" name="images" type="file" accept="image/*" multiple required />
      </div>

      <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Upload product"}
      </button>

      {status && <p className={styles.status}>{status}</p>}
    </form>
  );
};
