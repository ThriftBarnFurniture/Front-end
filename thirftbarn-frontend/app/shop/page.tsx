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

  const hasProducts = prepared.length > 0;

  return (
    <main className={styles.page}>
      <ScrollToTop />
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Shop</h1>
          <p className={styles.subtitle}>
            {hasProducts ? "All available items." : "Good things take time."}
          </p>
        </div>
      </header>

      {hasProducts ? (
        <ShopClient products={prepared} />
      ) : (
        <div className={styles.comingSoonWrapper}>
          {/* Fixed pin — everything below swings from this point */}
          <div className={styles.signHook} aria-hidden="true" />

          {/* Swinging assembly */}
          <div className={styles.signSwing}>
            <div className={styles.signRopes} aria-hidden="true" />
            <div className={styles.comingSoonSign}>
              <h2 className={styles.signTitle}>Products Coming Soon!</h2>
              <p className={styles.signSubtitle}>
                We&rsquo;re stocking the shelves &mdash; check back soon.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}