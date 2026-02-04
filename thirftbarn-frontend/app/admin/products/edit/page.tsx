import Link from "next/link";
import styles from "../page.module.css";
import { ProductEditor } from "./product-editor";
import { cookies } from "next/headers";

export default async function AdminProductsEditPage() {
  const cookieStore = await cookies();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch("https://front-end-cdca.vercel.app/api/admin/products", {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });

  const data = res.ok ? await res.json() : [];
  const products = Array.isArray(data) ? data : [];

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.card}>
          <header className={styles.header}>
            <div className={styles.titleWrap}>
              <p className={styles.eyebrow}>Admin</p>
              <h1 className={styles.title}>Edit Products</h1>
            </div>

            <div className={styles.actions}>
              <Link href="/admin/products" className={styles.dangerBtn}>
                ← Back
              </Link>
            </div>
          </header>

          <ProductEditor initialProducts={products} />
        </section>
      </div>
    </main>
  );
}
