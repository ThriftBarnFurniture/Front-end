import { createClient } from "@/utils/supabase/server";
import ShopClient from "./shop-client";
import styles from "./shop.module.css";

export const revalidate = 0;

export default async function ShopPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id,name,description,price_cents,currency,image_url,is_active,updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  return (
    <main className={styles.page}>
      <section className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.h1}>Shop</h1>
          <p className={styles.sub}>
            Live catalogue — products update in real time.
          </p>
        </header>

        <ShopClient initialProducts={products ?? []} />
      </section>
    </main>
  );
}
