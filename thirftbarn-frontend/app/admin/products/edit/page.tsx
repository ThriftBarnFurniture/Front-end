import styles from "../page.module.css";
import { ProductEditor } from "./product-editor";
import { cookies } from "next/headers";

export default async function AdminProductsEditPage() {
  const cookieStore = await cookies(); // ✅ MUST await

  // Convert cookies to "key=value; key2=value2" format
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch("http://localhost:3000/api/admin/products", {
    cache: "no-store",
    headers: {
      cookie: cookieHeader, // ✅ correct
    },
  });

  const data = res.ok ? await res.json() : [];
  const products = Array.isArray(data) ? data : [];

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>Edit Products</h1>
          <p className={styles.subtitle}>
            Search by name, price, colors, or category.
          </p>
        </header>

        <ProductEditor initialProducts={products} />
      </section>
    </main>
  );
}
