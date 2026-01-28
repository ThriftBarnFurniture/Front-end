"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import type { BarnDay, CategoryValue, Option } from "./productFormOptions";
import {
  CATEGORY_OPTIONS,
  SUBCATEGORY_MAP,
  ROOM_TAGS,
  COLLECTIONS,
  CONDITION_OPTIONS,
  COLOR_OPTIONS,
} from "./productFormOptions";


const barnBurnerPriceForDay = (day: BarnDay) => 45 - 5 * day; // day1=40 ... day7=10
const barnBurnerSubcategoryForDay = (day: BarnDay) => `day-${day}`; // "day-1"..."day-7"

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function asOptionList(arr: readonly string[]): Option[] {
  return arr.map((v) => ({ value: v, label: v }));
}

function ChipGrid({
  options,
  selected,
  onToggle,
  disabled,
}: {
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.chipGrid} aria-disabled={disabled ? "true" : "false"}>
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={[styles.chip, active ? styles.chipActive : ""].join(" ")}
            onClick={() => !disabled && onToggle(o.value)}
            disabled={disabled}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const ProductForm = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // still supported (for PATCH), but hidden now
  const [productId, setProductId] = useState("");

  // ✅ arrays
  const [categories, setCategories] = useState<CategoryValue[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [roomTags, setRoomTags] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);

  const [isBarnBurner, setIsBarnBurner] = useState(false);
  const [price, setPrice] = useState<string>("");

  // for restoring when toggling barn burner off
  const prevPriceRef = useRef<string>("");
  const prevCatsRef = useRef<CategoryValue[]>([]);
  const prevSubsRef = useRef<string[]>([]);
  const [barnDay, setBarnDay] = useState<BarnDay>(1);

  // Union subcategory options across selected categories (excluding barn-burner unless selected)
  const subcategoryOptions = useMemo<Option[]>(() => {
    const out: Option[] = [];
    const seen = new Set<string>();

    for (const cat of categories) {
      for (const s of SUBCATEGORY_MAP[cat] ?? []) {
        if (!seen.has(s.value)) {
          seen.add(s.value);
          out.push({ value: s.value, label: s.label });
        }
      }
    }

    return out;
  }, [categories]);

  // Prune subcategories if categories change (avoid sending invalid subs)
  const validSubSet = useMemo(() => {
    const allowed = new Set(subcategoryOptions.map((o) => o.value));
    return new Set([...allowed]);
  }, [subcategoryOptions]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    setStatus(null);
    setIsSubmitting(true);

    try {
      // quick client guard to match API validation (better UX)
      if (!isBarnBurner && categories.length === 0) {
        throw new Error("Please select at least one category.");
      }
      if (colors.length === 0) {
        throw new Error("Please select at least one color.");
      }

      // Ensure subs are valid for selected categories (unless barn burner)
      const cleanedSubs = isBarnBurner ? subcategories : subcategories.filter((s) => validSubSet.has(s));

      const formData = new FormData(form);

      // Barn Burner handling (server enforces too)
      if (isBarnBurner) {
        const locked = barnBurnerPriceForDay(barnDay);
        formData.set("price", String(locked));

        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        formData.set("is_barn_burner", "true");
        formData.set("barn_burner_started_at", now.toISOString());
        formData.set("barn_burner_day", String(barnDay));
        formData.set("barn_burner_last_tick", today);
      } else {
        formData.set("is_barn_burner", "false");
        formData.set("barn_burner_started_at", "");
        formData.set("barn_burner_day", "");
        formData.set("barn_burner_last_tick", "");
      }

      /**
       * ✅ IMPORTANT CHANGE:
       * Your updated API accepts arrays via repeated keys "category" and "subcategory"
       * (and is optionally compatible with "categories"/"subcategories").
       *
       * We will send repeated "category" + repeated "subcategory".
       */
      formData.delete("category");
      formData.delete("subcategory");
      categories.forEach((v) => formData.append("category", v));
      cleanedSubs.forEach((v) => formData.append("subcategory", v));

      // Arrays (already text[] in schema)
      formData.delete("room_tags");
      formData.delete("collections");
      formData.delete("colors");
      roomTags.forEach((v) => formData.append("room_tags", v));
      collections.forEach((v) => formData.append("collections", v));
      colors.forEach((v) => formData.append("colors", v));

      const selectedProductId = String(formData.get("productId") ?? "").trim();
      const method = selectedProductId ? "PATCH" : "POST";

      const response = await fetch("/api/admin/products", {
        method,
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();

      if (!response.ok) {
        const errorMessage =
          typeof payload === "string" ? payload || "Unable to save product." : payload?.error ?? "Unable to save product.";
        throw new Error(errorMessage);
      }

      // reset UI
      form.reset();
      setIsBarnBurner(false);
      setBarnDay(1);
      setPrice("");
      setProductId("");

      setCategories([]);
      setSubcategories([]);
      setRoomTags([]);
      setCollections([]);
      setColors([]);

      setStatus("Product saved successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryAsOptions: Option[] = useMemo(
    () => CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.label })),
    []
  );

  const roomAsOptions: Option[] = useMemo(
    () => ROOM_TAGS.map((t) => ({ value: t.value, label: t.label })),
    []
  );

  const collectionsAsOptions: Option[] = useMemo(
    () => COLLECTIONS.map((c) => ({ value: c.value, label: c.label })),
    []
  );

  const colorsAsOptions: Option[] = useMemo(() => asOptionList(COLOR_OPTIONS), []);

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {/* Hidden productId for updates only */}
      <input type="hidden" name="productId" value={productId} />

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="name">
          Product name *
        </label>
        <input className={styles.input} id="name" name="name" type="text" required />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={isBarnBurner}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsBarnBurner(checked);

              if (checked) {
                // store previous selections
                prevPriceRef.current = price;
                prevCatsRef.current = categories;
                prevSubsRef.current = subcategories;

                const day: BarnDay = 1;
                setBarnDay(day);

                // lock BB selection
                setCategories(["barn-burner"]);
                setSubcategories([barnBurnerSubcategoryForDay(day)]);
                setPrice(String(barnBurnerPriceForDay(day)));
              } else {
                // restore previous selections
                setCategories(prevCatsRef.current ?? []);
                setSubcategories(prevSubsRef.current ?? []);
                setPrice(prevPriceRef.current || "");
              }
            }}
          />
          <span className={styles.checkboxLabel}>Is this a barn burner item?</span>
        </label>

        {isBarnBurner && (
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="barn_day">
              What day will this item start on? *
            </label>
            <select
              className={styles.input}
              id="barn_day"
              value={barnDay}
              onChange={(e) => {
                const day = Number(e.target.value) as BarnDay;
                setBarnDay(day);
                setSubcategories([barnBurnerSubcategoryForDay(day)]);
                setPrice(String(barnBurnerPriceForDay(day)));
              }}
            >
              <option value={1}>Day 1</option>
              <option value={2}>Day 2</option>
              <option value={3}>Day 3</option>
              <option value={4}>Day 4</option>
              <option value={5}>Day 5</option>
              <option value={6}>Day 6</option>
              <option value={7}>Day 7</option>
            </select>
          </div>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="quantity">
          Quantity *
        </label>
        <input className={styles.input} id="quantity" name="quantity" type="number" step="1" min="0" required />
      </div>

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
          value={price}
          disabled={isBarnBurner}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      {/* ✅ Categories (multi) */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Categories *</label>
        <ChipGrid
          options={categoryAsOptions}
          selected={categories}
          disabled={isBarnBurner}
          onToggle={(v) => {
            const next = toggleValue(categories as string[], v) as CategoryValue[];
            setCategories(next);

            // prune subcategories not allowed anymore (unless barn burner)
            if (!isBarnBurner) {
              const allowed = new Set(
                next.flatMap((cat) => (SUBCATEGORY_MAP[cat] ?? []).map((s) => s.value))
              );
              setSubcategories((prev) => prev.filter((s) => allowed.has(s)));
            }
          }}
        />
        <p className={styles.status}>Select one or more.</p>
      </div>

      {/* ✅ Subcategories (multi) */}
      {categories.length > 0 && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Subcategories</label>
          <ChipGrid
            options={subcategoryOptions}
            selected={subcategories}
            disabled={isBarnBurner}
            onToggle={(v) => setSubcategories(toggleValue(subcategories, v))}
          />
          <p className={styles.status}>Optional. Select any that apply.</p>
        </div>
      )}

      {/* ✅ Room tags (multi) */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Room tags</label>
        <ChipGrid options={roomAsOptions} selected={roomTags} onToggle={(v) => setRoomTags(toggleValue(roomTags, v))} />
      </div>

      {/* ✅ Collections (multi) */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Collections</label>
        <ChipGrid
          options={collectionsAsOptions}
          selected={collections}
          onToggle={(v) => setCollections(toggleValue(collections, v))}
        />
      </div>

      {/* ✅ Colors (multi, required) */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Colors *</label>
        <ChipGrid options={colorsAsOptions} selected={colors} onToggle={(v) => setColors(toggleValue(colors, v))} />
        <p className={styles.status}>Select one or more colors.</p>
      </div>

      {/* Dimensions with inches */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Dimensions (inches)</label>
        <div className={styles.dimGrid}>
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

      {/* Photos REQUIRED*/}
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="images">
          Photos * (max 10MB)
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
