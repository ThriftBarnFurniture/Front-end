"use client";

import { useState } from "react";
import { createProduct, deleteProduct, updateProduct } from "./actions";
import styles from "./products.module.css";

type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  is_active: boolean;
  updated_at: string;
};

export default function AdminProductsClient({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <button className={styles.primaryBtn} onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Add new product"}
        </button>

        {open && (
          <form className={styles.form} action={createProduct}>
            <input className={styles.input} name="name" placeholder="Name" required />
            <input className={styles.input} name="description" placeholder="Description" required />
            <input className={styles.input} name="price_cents" placeholder="Price (cents)" type="number" required />
            <input className={styles.input} name="currency" defaultValue="cad" />
            <input className={styles.input} name="image_url" placeholder="Image URL (optional)" />
            <button className={styles.primaryBtn} type="submit">Create</button>
          </form>
        )}
      </section>

      {products.map((p) => (
        <section key={p.id} className={styles.card}>
          <form className={styles.form} action={updateProduct}>
            <input type="hidden" name="id" value={p.id} />
            <input className={styles.input} name="name" defaultValue={p.name} required />
            <input className={styles.input} name="description" defaultValue={p.description} required />
            <input className={styles.input} name="price_cents" type="number" defaultValue={p.price_cents} required />
            <input className={styles.input} name="currency" defaultValue={p.currency} />
            <input className={styles.input} name="image_url" defaultValue={p.image_url ?? ""} placeholder="Image URL" />

            <label className={styles.checkboxRow}>
              <input type="hidden" name="is_active" value="false" />
              <input type="checkbox" name="is_active" value="true" defaultChecked={p.is_active} />
              Active (visible in shop)
            </label>

            <div className={styles.row}>
              <button className={styles.primaryBtn} type="submit">Save</button>
              <form action={deleteProduct}>
                <input type="hidden" name="id" value={p.id} />
                <button className={styles.dangerBtn} type="submit">Delete</button>
              </form>
            </div>
          </form>
        </section>
      ))}
    </div>
  );
}
