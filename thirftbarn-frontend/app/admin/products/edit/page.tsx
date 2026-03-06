import Link from "next/link";
import styles from "../page.module.css";
import { ProductEditor } from "./product-editor";
import { cookies, headers } from "next/headers";

export default async function AdminProductsEditPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const base = envBase || (host ? `${proto}://${host}` : "");

  if (!base) {
    throw new Error("Could not determine site URL for admin product fetch.");
  }

  const res = await fetch(`${base}/api/admin/products`, {
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
