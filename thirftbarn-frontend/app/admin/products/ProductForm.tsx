"use client";

import { useState } from "react";
import styles from "./page.module.css";

export const ProductForm = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
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

      event.currentTarget.reset();
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
        <label className={styles.label} htmlFor="image">
          Product image
        </label>
        <input className={styles.input} id="image" name="image" type="file" accept="image/*" required />
      </div>

      <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading..." : "Upload product"}
      </button>

      {status && <p className={styles.status}>{status}</p>}
    </form>
  );
};
