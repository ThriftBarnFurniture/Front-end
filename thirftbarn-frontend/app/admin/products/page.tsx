import { requireAdmin } from "@/lib/require-admin";
import styles from "./products.module.css";
import AdminProductsClient from "./products-client";

export default async function AdminProductsPage() {
  const { supabase } = await requireAdmin();

  const { data: products } = await supabase
    .from("products")
    .select("id,name,description,price_cents,currency,image_url,is_active,updated_at")
    .order("updated_at", { ascending: false });

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.h1}>Admin · Products</h1>
          <p className={styles.sub}>
            Add / edit / delete products. Changes appear on /shop in real time.
          </p>
        </header>

        <AdminProductsClient products={products ?? []} />
      </div>
    </main>
  );
}
