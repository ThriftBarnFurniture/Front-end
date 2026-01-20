import Link from "next/link";
import styles from "./page.module.css";

export default function AdminProductsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>Manage Products</h1>
          <p className={styles.subtitle}>
            Choose an action: upload a new product or search/edit existing ones.
          </p>
        </header>

        <div className={styles.actions}>
          <Link href="/admin/products/upload" className={styles.actionCard}>
            <div className={styles.actionTop}>
              <h2 className={styles.actionTitle}>Upload Product</h2>
              <p className={styles.actionDesc}>
                Add a new item to Supabase and upload images.
              </p>
            </div>
            <span className={styles.actionCta}>Go to upload →</span>
          </Link>

          <Link href="/admin/products/edit" className={styles.actionCard}>
            <div className={styles.actionTop}>
              <h2 className={styles.actionTitle}>Edit Product</h2>
              <p className={styles.actionDesc}>
                Browse + search existing products by name, price, color, category.
              </p>
            </div>
            <span className={styles.actionCta}>Go to editor →</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
