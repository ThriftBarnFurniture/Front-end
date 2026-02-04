import Link from "next/link";
import styles from "../page.module.css";
import { ProductForm } from "../ProductForm";

export default function AdminProductsUploadPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.card}>
          <div className={styles.header}>
            <div className={styles.titleWrap}>
              <p className={styles.eyebrow}>Admin Only</p>
              <h1 className={styles.title}>Upload Product</h1>
            </div>

            <div className={styles.actions}>
              <Link href="/admin/products" className={styles.dangerBtn}>
                ← Back
              </Link>
            </div>
          </div>

          <ProductForm />
        </section>
      </div>
    </main>
  );
}
