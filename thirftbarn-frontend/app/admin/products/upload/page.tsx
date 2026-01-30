import styles from "../page.module.css";
import { ProductForm } from "../ProductForm";

export default function AdminProductsUploadPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Admin Only</p>
          <h1 className={styles.title}>Upload Product to shop</h1>
        </header>

        <ProductForm />
      </section>
    </main>
  );
}
