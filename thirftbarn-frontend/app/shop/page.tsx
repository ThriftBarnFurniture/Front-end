import Image from "next/image";
import Link from "next/link";
import styles from "./shop.module.css";
import { getShopProducts, getPrimaryImage, formatPrice } from "@/lib/products";

export default async function ShopPage() {
  const products = await getShopProducts();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Shop</h1>
        <p className={styles.subtitle}>All available items.</p>
      </header>

      {products.length === 0 ? (
        <p className={styles.empty}>No products available right now.</p>
      ) : (
        <section className={styles.grid}>
          {products.map((p) => {
            const img = getPrimaryImage(p);
            const price = formatPrice(p.price);

            return (
              <Link key={p.id} href={`/item/${p.id}`} className={styles.card}>
                <div className={styles.imageWrap}>
                  {img ? (
                    <Image
                      src={img}
                      alt={p.name}
                      fill
                      className={styles.image}
                      sizes="(max-width: 700px) 100vw, (max-width: 1200px) 33vw, 25vw"
                    />
                  ) : (
                    <div className={styles.noImage}>No image</div>
                  )}

                  {p.quantity !== null && p.quantity <= 0 && (
                    <div className={styles.badge}>Sold</div>
                  )}
                </div>

                <div className={styles.meta}>
                  <div className={styles.name}>{p.name}</div>
                  <div className={styles.price}>{price}</div>
                </div>

                {p.category && <div className={styles.sub}>{p.category}</div>}
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
