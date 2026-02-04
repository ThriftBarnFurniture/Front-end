"use client";

import React, { useMemo, useRef, useState } from "react";
import styles from "./forms.module.css";
import type { BarnDay, CategoryValue, Option } from "./productFormOptions";
import {
  CATEGORY_OPTIONS,
  SUBCATEGORY_MAP,
  ROOM_TAGS,
  COLLECTIONS,
  CONDITION_OPTIONS,
  COLOR_OPTIONS,
} from "./productFormOptions";

// Day1=40, Day2=35 ... Day7=10
const barnBurnerPriceForDay = (day: BarnDay) => Math.max(10, 40 - 5 * (day - 1));
const barnBurnerSubcategoryForDay = (day: BarnDay) => `day-${day}`;

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

function colorToHex(label: string) {
  const k = label.trim().toLowerCase();

  // Basic + your common furniture colors
  const map: Record<string, string> = {
    black: "#111111",
    white: "#ffffff",
    gray: "#9ca3af",
    grey: "#9ca3af",
    silver: "#c0c0c0",
    gold: "#d4af37",
    beige: "#f5f5dc",
    cream: "#fffdd0",
    brown: "#8b5a2b",
    tan: "#d2b48c",

    "natural wood": "#c8a165",
    oak: "#c9a26b",
    walnut: "#5b3a29",
    cherry: "#7b2d26",
    pine: "#d6c28f",
    mahogany: "#4a1f1f",

    blue: "#2563eb",
    navy: "#1e3a8a",
    teal: "#0f766e",
    green: "#16a34a",
    olive: "#556b2f",
    red: "#dc2626",
    burgundy: "#800020",
    pink: "#ec4899",
    purple: "#7c3aed",
    yellow: "#f59e0b",
    orange: "#f97316",

    brass: "#b5a642",
    copper: "#b87333",
    chrome: "#bfc5c9",

    "clear/glass": "#e5e7eb",
  };

  return map[k] ?? "#111111";
}

function ColorChipGrid({
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
        const hex = colorToHex(o.label);
        const isWhite = o.label.trim().toLowerCase() === "white";

        return (
          <button
            key={o.value}
            type="button"
            className={[styles.chip, styles.colorChip, active ? styles.chipActive : ""].join(" ")}
            onClick={() => !disabled && onToggle(o.value)}
            disabled={disabled}
            style={
              {
                ["--swatch" as any]: hex,
                ["--tint" as any]: active && !isWhite ? `${hex}22` : "transparent",
              } as React.CSSProperties
            }
          >
            <span className={[styles.swatch, isWhite ? styles.swatchWhite : ""].join(" ")} aria-hidden />
            <span className={styles.colorLabel}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const ProductForm = ({
  mode = "create",
  initialProduct,
}: {
  mode?: "create" | "edit";
  initialProduct?: Record<string, any>;
}) => {
  const init = initialProduct ?? {};

  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // supported (PATCH), hidden input
  const [productId, setProductId] = useState<string>(mode === "edit" ? String(init.id ?? "") : "");

  // arrays (prefill in edit)
  const [categories, setCategories] = useState<CategoryValue[]>(() => {
    const v = init.category ?? init.categories;
    if (Array.isArray(v)) return v as CategoryValue[];
    if (typeof v === "string" && v.trim()) return [v as CategoryValue];
    return [];
  });

  const [subcategories, setSubcategories] = useState<string[]>(() => {
    const v = init.subcategory ?? init.subcategories;
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === "string" && v.trim()) return [v];
    return [];
  });

  const [roomTags, setRoomTags] = useState<string[]>(() => (Array.isArray(init.room_tags) ? init.room_tags : []));
  const [collections, setCollections] = useState<string[]>(() => (Array.isArray(init.collections) ? init.collections : []));
  const [colors, setColors] = useState<string[]>(() => (Array.isArray(init.colors) ? init.colors : []));

  const [isBarnBurner, setIsBarnBurner] = useState<boolean>(!!init.is_barn_burner);
  const [barnDay, setBarnDay] = useState<BarnDay>((Number(init.barn_burner_day ?? 1) || 1) as BarnDay);

  const [price, setPrice] = useState<string>(() => (init.price != null ? String(init.price) : ""));
  const [isOversized, setIsOversized] = useState<boolean>(!!init.is_oversized);
  const [isMonthlyPriceDrop, setIsMonthlyPriceDrop] = useState<boolean>(!!init.is_monthly_price_drop);

  // for restoring when toggling barn burner off
  const prevPriceRef = useRef<string>("");
  const prevCatsRef = useRef<CategoryValue[]>([]);
  const prevSubsRef = useRef<string[]>([]);

  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);

  // Existing photos for edit mode
  const initialImages = useMemo(() => {
    const arr = Array.isArray(init?.image_urls) ? init.image_urls.filter(Boolean) : [];
    const single = init?.image_url ? [init.image_url] : [];
    return Array.from(new Set([...arr, ...single]));
  }, [init]);

  const [keptImages, setKeptImages] = useState<string[]>(initialImages);

  const onToggleRemove = (url: string) => {
    setKeptImages((prev) => (prev.includes(url) ? prev.filter((x) => x !== url) : [...prev, url]));
  };

  // Union subcategory options across selected categories
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
      // Client guards
      if (!isBarnBurner && categories.length === 0) throw new Error("Please select at least one category.");
      if (colors.length === 0) throw new Error("Please select at least one color.");
      if (!price.trim()) throw new Error("Please enter a price.");

      // Ensure subs are valid for selected categories (unless barn burner)
      const cleanedSubs = isBarnBurner ? subcategories : subcategories.filter((s) => validSubSet.has(s));

      const formData = new FormData(form);

      // booleans
      formData.set("is_oversized", isOversized ? "true" : "false");
      formData.set("is_monthly_price_drop", isMonthlyPriceDrop ? "true" : "false");

      // ✅ Barn Burner: force price + set day
      if (isBarnBurner) {
        const forced = barnBurnerPriceForDay(barnDay);
        formData.set("price", String(forced));
        formData.set("is_barn_burner", "true");
        formData.set("barn_burner_day", String(barnDay));
      } else {
        formData.set("is_barn_burner", "false");
        formData.set("barn_burner_day", "");
      }

      // arrays via repeated keys
      formData.delete("category");
      formData.delete("subcategory");
      categories.forEach((v) => formData.append("category", v));
      cleanedSubs.forEach((v) => formData.append("subcategory", v));

      formData.delete("room_tags");
      formData.delete("collections");
      formData.delete("colors");
      roomTags.forEach((v) => formData.append("room_tags", v));
      collections.forEach((v) => formData.append("collections", v));
      colors.forEach((v) => formData.append("colors", v));

      // edit mode extras: productId + keep_image_urls
      if (mode === "edit") {
        const id = String(init.id ?? productId).trim();
        formData.set("productId", id);
        formData.delete("keep_image_urls");
        keptImages.forEach((u) => formData.append("keep_image_urls", u));
      }

      const method = mode === "edit" ? "PATCH" : "POST";

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

      if (mode !== "edit") {
        // reset UI on create only
        form.reset();
        setIsBarnBurner(false);
        setIsMonthlyPriceDrop(false);
        setIsOversized(false);
        setBarnDay(1);
        setPrice("");
        setProductId("");

        setCategories([]);
        setSubcategories([]);
        setRoomTags([]);
        setCollections([]);
        setColors([]);
      }

      setStatus(mode === "edit" ? "Saved ✅" : "Product saved successfully.");
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

  const roomAsOptions: Option[] = useMemo(() => ROOM_TAGS.map((t) => ({ value: t.value, label: t.label })), []);
  const collectionsAsOptions: Option[] = useMemo(() => COLLECTIONS.map((c) => ({ value: c.value, label: c.label })), []);
  const colorsAsOptions: Option[] = useMemo(() => asOptionList(COLOR_OPTIONS), []);

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <input type="hidden" name="productId" value={productId} />

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="name">
          Product Name *
        </label>
        <input className={styles.input} id="name" name="name" type="text" required defaultValue={init.name ?? ""} />
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.checkboxGrid}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={isBarnBurner}
              disabled={isMonthlyPriceDrop}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked && isMonthlyPriceDrop) return;

                setIsBarnBurner(checked);

                if (checked) {
                  prevPriceRef.current = price;
                  prevCatsRef.current = categories;
                  prevSubsRef.current = subcategories;

                  const day: BarnDay = (Number(init.barn_burner_day ?? 1) || 1) as BarnDay;
                  setBarnDay(day);

                  setCategories(["barn-burner"]);
                  setSubcategories([barnBurnerSubcategoryForDay(day)]);
                  setPrice(String(barnBurnerPriceForDay(day)));
                } else {
                  setCategories(prevCatsRef.current ?? []);
                  setSubcategories(prevSubsRef.current ?? []);
                  setPrice(prevPriceRef.current || "");
                }
              }}
            />
            <span className={styles.checkboxLabel}>Barn Burner Item?</span>
          </label>

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={isOversized} onChange={(e) => setIsOversized(e.target.checked)} />
            <span className={styles.checkboxLabel}>Oversized Item?</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={isMonthlyPriceDrop}
              disabled={isBarnBurner}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsMonthlyPriceDrop(checked);
                if (checked) setIsBarnBurner(false);
              }}
            />
            <span className={styles.checkboxLabel}>Monthly Price Drop Item? (-10$/month)</span>
          </label>
        </div>

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
        <input
          className={styles.input}
          id="quantity"
          name="quantity"
          type="number"
          step="1"
          min="0"
          required
          defaultValue={init.quantity ?? 0}
        />
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

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Categories *</label>
        <ChipGrid
          options={categoryAsOptions}
          selected={categories}
          disabled={isBarnBurner}
          onToggle={(v) => {
            if (v === "barn-burner") {
              setCategoryWarning("To make an item a barn-burner, please select it through the checkbox above.");
              return;
            }

            setCategoryWarning(null);

            const next = toggleValue(categories as string[], v) as CategoryValue[];
            setCategories(next);

            if (!isBarnBurner) {
              const allowed = new Set(next.flatMap((cat) => (SUBCATEGORY_MAP[cat] ?? []).map((s) => s.value)));
              setSubcategories((prev) => prev.filter((s) => allowed.has(s)));
            }
          }}
        />
        {categoryWarning && (
          <p className={styles.status} role="alert">
            {categoryWarning}
          </p>
        )}
        <p className={styles.status}>Select one or more.</p>
      </div>

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

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Room tags</label>
        <ChipGrid options={roomAsOptions} selected={roomTags} onToggle={(v) => setRoomTags(toggleValue(roomTags, v))} />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Collections</label>
        <ChipGrid options={collectionsAsOptions} selected={collections} onToggle={(v) => setCollections(toggleValue(collections, v))} />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Colors *</label>
        <ColorChipGrid options={colorsAsOptions} selected={colors} onToggle={(v) => setColors(toggleValue(colors, v))} />
        <p className={styles.status}>Select one or more colors.</p>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Dimensions (inches)</label>
        <div className={styles.dimGrid}>
          <input
            className={styles.input}
            name="height"
            type="number"
            step="0.01"
            min="0"
            placeholder='Height (")'
            defaultValue={init.height ?? ""}
          />
          <input
            className={styles.input}
            name="width"
            type="number"
            step="0.01"
            min="0"
            placeholder='Width (")'
            defaultValue={init.width ?? ""}
          />
          <input
            className={styles.input}
            name="depth"
            type="number"
            step="0.01"
            min="0"
            placeholder='Depth (")'
            defaultValue={init.depth ?? ""}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="condition">
          Condition *
        </label>
        <select className={styles.input} id="condition" name="condition" required defaultValue={init.condition ?? ""}>
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

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="description">
          Description *
        </label>
        <textarea className={styles.textarea} id="description" name="description" rows={6} required defaultValue={init.description ?? ""} />
      </div>

      {mode === "edit" && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Current photos</label>

          {initialImages.length === 0 ? (
            <p className={styles.status}>No photos found.</p>
          ) : (
            <div className={styles.imageGrid}>
              {initialImages.map((url: string) => {
                const kept = keptImages.includes(url);
                return (
                  <button
                    key={url}
                    type="button"
                    className={[styles.imageTile, kept ? "" : styles.imageTileRemove].join(" ")}
                    onClick={() => onToggleRemove(url)}
                    title={kept ? "Click to remove" : "Click to keep"}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className={styles.imageThumb} />
                    <div className={styles.imageCaption}>{kept ? "Keeping" : "Will remove"}</div>
                  </button>
                );
              })}
            </div>
          )}

          <p className={styles.status}>
            Click a photo to toggle <strong>remove/keep</strong>.
          </p>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="images">
          {mode === "edit" ? "Add new photos (optional)" : "Photos * (max 10MB)"}
        </label>
        <input
          className={styles.input}
          id="images"
          name="images"
          type="file"
          accept="image/*"
          multiple
          required={mode !== "edit"}
        />
      </div>

      <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : mode === "edit" ? "Save changes" : "Upload product"}
      </button>

      {status && <p className={styles.status}>{status}</p>}
    </form>
  );
};
