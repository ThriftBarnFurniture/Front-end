"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "../../../products/page.module.css";

type Product = Record<string, any>;

export default function EditProductClient({ initialProduct }: { initialProduct: Product }) {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Existing photos (image_urls + fallback to image_url)
  const initialImages = useMemo(() => {
    const arr = Array.isArray(initialProduct?.image_urls) ? initialProduct.image_urls.filter(Boolean) : [];
    const single = initialProduct?.image_url ? [initialProduct.image_url] : [];
    const merged = Array.from(new Set([...arr, ...single]));
    return merged;
  }, [initialProduct]);

  const [keptImages, setKeptImages] = useState<string[]>(initialImages);

  const onToggleRemove = (url: string) => {
    setKeptImages((prev) => (prev.includes(url) ? prev.filter((x) => x !== url) : [...prev, url]));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    const form = e.currentTarget;
    const fd = new FormData(form);

    // Tell backend which images to keep (so it can remove the rest)
    fd.set("productId", String(initialProduct.id));
    fd.delete("keep_image_urls");
    keptImages.forEach((u) => fd.append("keep_image_urls", u));

    try {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        body: fd,
      });

      const ct = res.headers.get("content-type") || "";
      const payload = ct.includes("application/json") ? await res.json() : await res.text();

      if (!res.ok) {
        const msg = typeof payload === "string" ? payload : payload?.error || "Update failed.";
        throw new Error(msg);
      }

      setStatus("Saved ✅");
    } catch (err: any) {
      setStatus(err?.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <Link className={styles.secondaryButton ?? styles.submitButton} href="/admin/products/edit">
          ← Back to list
        </Link>
      </div>

      {/* Prefill inputs using defaultValue so it behaves like your upload form */}
      <input type="hidden" name="productId" value={initialProduct.id} />

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Product name *</label>
        <input className={styles.input} name="name" type="text" required defaultValue={initialProduct.name ?? ""} />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Quantity *</label>
        <input className={styles.input} name="quantity" type="number" step="1" min="0" required defaultValue={initialProduct.quantity ?? 0} />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Price (CAD) *</label>
        <input className={styles.input} name="price" type="number" step="0.01" min="0" required defaultValue={initialProduct.price ?? 0} />
      </div>

      <div className={styles.fieldGroup}>
      <label className={styles.label}>Category *</label>
      <input
        className={styles.input}
        name="category"
        required
        defaultValue={initialProduct.category ?? ""}
      />
      </div>

      <div className={styles.fieldGroup}>
      <label className={styles.label}>Condition *</label>
      <input
        className={styles.input}
        name="condition"
        required
        defaultValue={initialProduct.condition ?? ""}
      />
      </div>

      <div className={styles.fieldGroup}>
      <label className={styles.label}>Colors *</label>
      <select
        className={styles.input}
        name="colors"
        multiple
        size={6}
        required
        defaultValue={Array.isArray(initialProduct.colors) ? initialProduct.colors : []}
      >
        {/* use the same COLOR_OPTIONS list as ProductForm */}
        {[
        "Black","White","Gray","Silver","Gold","Beige","Cream","Brown","Tan",
        "Natural Wood","Oak","Walnut","Cherry","Pine","Mahogany","Blue","Navy",
        "Teal","Green","Olive","Red","Burgundy","Pink","Purple","Yellow","Orange",
        "Clear/Glass","Transparent","Multicolor","Brass","Copper","Chrome",
        ].map((c) => (
        <option key={c} value={c}>{c}</option>
        ))}
      </select>
      </div>


      <div className={styles.fieldGroup}>
        <label className={styles.label}>Description *</label>
        <textarea className={styles.textarea} name="description" rows={6} required defaultValue={initialProduct.description ?? ""} />
      </div>

      {/* Existing photos */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Current photos</label>

        {initialImages.length === 0 ? (
          <p className={styles.status}>No photos found.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {initialImages.map((url) => {
              const kept = keptImages.includes(url);
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => onToggleRemove(url)}
                  style={{
                    borderRadius: 14,
                    border: kept ? "1px solid rgba(0,0,0,0.12)" : "2px solid #b00020",
                    overflow: "hidden",
                    background: "#fff",
                    padding: 0,
                    cursor: "pointer",
                    position: "relative",
                  }}
                  title={kept ? "Click to remove" : "Click to keep"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                  <div style={{ padding: 10, fontWeight: 800, fontSize: 12, opacity: 0.9 }}>
                    {kept ? "Keeping" : "Will remove"}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className={styles.status}>
          Click a photo to toggle <strong>remove/keep</strong>.
        </p>
      </div>

      {/* Add new photos (optional on edit) */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Add new photos (optional)</label>
        <input className={styles.input} name="images" type="file" accept="image/*" multiple />
      </div>

      <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </button>

      {status && <p className={styles.status}>{status}</p>}
    </form>
  );
}
