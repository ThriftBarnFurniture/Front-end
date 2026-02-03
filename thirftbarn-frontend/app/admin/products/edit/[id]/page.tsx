import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import styles from "../../page.module.css";
import EditProductClient from "./EditProductClient";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // ✅ unwrap params

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";

  const res = await fetch(`${base}/api/admin/products/${id}`, {
    cache: "no-store",
    headers: { cookie: cookieHeader },
  });

  if (res.status === 404) return notFound();
  if (!res.ok) throw new Error("Failed to load product.");

  const product = await res.json();

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <EditProductClient initialProduct={product} />
      </section>
    </main>
  );
}
