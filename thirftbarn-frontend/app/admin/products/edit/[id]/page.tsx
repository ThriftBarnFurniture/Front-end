import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

// admin layout + dangerBtn lives here
import pageStyles from "@/app/admin/products/page.module.css";

import { ProductForm } from "../../ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const res = await fetch(`${base}/api/admin/products/${id}`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });

  if (res.status === 404) return notFound();
  if (!res.ok) throw new Error("Failed to load product.");

  const product = await res.json();

  return (
    <main className={pageStyles.page}>
      <div className={pageStyles.container}>
        <section className={pageStyles.card}>
          <header className={pageStyles.header}>
            <div className={pageStyles.titleWrap}>
              <p className={pageStyles.eyebrow}>Admin</p>
              <h1 className={pageStyles.title}>Edit Product</h1>
              <p className={pageStyles.subtitle}>
                Update product details and photos.
              </p>
            </div>

            <div className={pageStyles.actions}>
              {/* correct destination */}
              <Link href="/admin/products" className={pageStyles.dangerBtn}>
                ← Back
              </Link>
            </div>
          </header>

          {/* ProductForm still uses its own internal form styles */}
          <ProductForm mode="edit" initialProduct={product} />
        </section>
      </div>
    </main>
  );
}
