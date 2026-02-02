import styles from "./shop.module.css";
import ShopClient from "./shop-client";
import { getShopProducts, getPrimaryImage, formatPrice } from "@/lib/products";
import ScrollToTop from "@/components/ui/ScrollToTop";

export default async function ShopPage() {
  const products = await getShopProducts();

  const prepared = products.map((p) => ({
    id: p.id,
    name: p.name,
    quantity: p.quantity,
    category: p.category ?? [],
    created_at: p.created_at,

    room_tags: p.room_tags ?? [],
    collections: p.collections ?? [],
    subcategory: p.subcategory ?? [],

    // ✅ NEW canonical comparison
    initial_price: p.initial_price ?? null,

    img: getPrimaryImage(p) ?? null,
    priceLabel: formatPrice(p.price),
    priceNumber: typeof p.price === "string" ? Number(p.price) : p.price,
  }));

  return (
    <main className={styles.page}>
      <ScrollToTop />
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Shop</h1>
          <p className={styles.subtitle}>All available items.</p>
        </div>
      </header>

      <ShopClient products={prepared} />
    </main>
  );
}
