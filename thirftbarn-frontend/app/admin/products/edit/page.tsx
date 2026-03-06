import Link from "next/link";
import styles from "../page.module.css";
import { ProductEditor } from "./product-editor";
import type { Product } from "./product-editor";
import { cookies, headers } from "next/headers";

export default async function AdminProductsEditPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "")
    .split(",")[0]
    .trim();
  const proto = (headerStore.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  const requestBase = host ? `${proto}://${host}` : "";
  const base = requestBase || envBase;

  if (!base) {
    throw new Error("Could not determine site URL for admin product fetch.");
  }

  const res = await fetch(`${base}/api/admin/products`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });

  let products: Product[] = [];
  let loadError: string | null = null;

  if (res.ok) {
    const data = await res.json();
    products = Array.isArray(data) ? data : [];
  } else {
    const body = await res.text().catch(() => "");
    loadError = `Failed to load products (${res.status} ${res.statusText})${
      body ? `: ${body}` : "."
    }`;
  }

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

          {loadError ? (
            <p style={{ color: "#b42318", fontWeight: 700 }}>{loadError}</p>
          ) : (
            <ProductEditor initialProducts={products} />
          )}
        </section>
      </div>
    </main>
  );
}
