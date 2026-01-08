import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import styles from "./product.module.css";

export const revalidate = 0;

type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
};

function formatMoney(cents: number, currency: string) {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id,name,description,price_cents,currency,image_url")
    .eq("id", params.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <section className={styles.wrap}>
        <Link className={styles.backLink} href="/shop">
          ← Back to shop
        </Link>

        <article className={styles.card}>
          <div className={styles.imageWrap}>
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className={styles.img}
                sizes="(max-width: 900px) 100vw, 60vw"
              />
            ) : (
              <div className={styles.imgFallback}>No image</div>
            )}
          </div>

          <div className={styles.details}>
            <div className={styles.row}>
              <h1 className={styles.title}>{product.name}</h1>
              <div className={styles.price}>
                {formatMoney(product.price_cents, product.currency)}
              </div>
            </div>
            <p className={styles.desc}>{product.description}</p>
          </div>
        </article>
      </section>
    </main>
  );
}
