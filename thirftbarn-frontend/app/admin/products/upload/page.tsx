import styles from "../page.module.css";
import { ProductForm } from "../ProductForm";

export default function AdminProductsUploadPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>Upload Product</h1>
          <p className={styles.subtitle}>
            Upload new items to Supabase and sync them to Cloudflare for storefront visibility.
          </p>
        </header>

        <ProductForm />
      </section>
    </main>
  );
}
