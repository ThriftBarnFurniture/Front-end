"use client";

import { useState } from "react";
import styles from "./page.module.css";

export const ProductForm = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productId, setProductId] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget; // ✅ capture immediately

    setStatus(null);
    setIsSubmitting(true);

    const formData = new FormData(form);
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

        form.reset();       // ✅ use captured ref
        setProductId("");   // ✅ keep state in sync with cleared input
        setStatus("Product uploaded successfully.");
    } catch (error) {
        const message = error instanceof Error ? error.message : "Something went wrong.";
        setStatus(message);
    } finally {
        setIsSubmitting(false);
    }
    };


  return (
    <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="productId">
          Product ID (optional, for updates)
        </label>
        <input
          className={styles.input}
          id="productId"
          name="productId"
          type="text"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        />
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="name">
          Product name
        </label>
        <input className={styles.input} id="name" name="name" type="text" required />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="category">
          Category
        </label>
        <input className={styles.input} id="category" name="category" type="text" required />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="price">
          Price
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

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="quantity">
          Quantity
        </label>
        <input
          className={styles.input}
          id="quantity"
          name="quantity"
          type="number"
          step="1"
          min="0"
          required
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="description">
          Description
        </label>
        <textarea className={styles.textarea} id="description" name="description" rows={5} required />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="images">
          Product images (up to 5)
        </label>
        <input className={styles.input} id="images" name="images" type="file" accept="image/*" multiple required={!productId} />
      </div>

      <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : "Upload product"}
      </button>

      {status && <p className={styles.status}>{status}</p>}
    </form>
  );
};
