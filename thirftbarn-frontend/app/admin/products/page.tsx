import Link from "next/link";
import styles from "./page.module.css";

export default function AdminProductsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <h1 className={styles.h1}>Manage Products</h1>
          </div>

          <div className={styles.actions}>
            <Link className={styles.dangerBtn} href="/">
              Back to Store
            </Link>
          </div>
        </header>

        <h2 className={styles.sectionTitle}>Select a tool</h2>

        <div className={styles.grid}>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Upload Product</h3>
            <p className={styles.cardText}>Add a new item to Supabase.</p>
            <div className={styles.cardLinkRow}>
              <Link className={styles.linkPill} href="/admin/products/upload">
                Upload <span aria-hidden>›</span>
              </Link>
            </div>
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Edit Products</h3>
            <p className={styles.cardText}>Edit existing Products.</p>
            <div className={styles.cardLinkRow}>
              <Link className={styles.linkPill} href="/admin/products/edit">
                Edit <span aria-hidden>›</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
