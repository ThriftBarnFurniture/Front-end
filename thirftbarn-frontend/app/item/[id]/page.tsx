import { notFound } from "next/navigation";
import styles from "./item.module.css";
import ImageGallery from "./ImageGallery";
import { formatPrice, getAllImages, getProductById } from "@/lib/products";
import AddToCartButton from "@/components/cart/AddToCartButton";
import ScrollToTop from "./ScrollToTop";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await getProductById(id);
  if (!product) notFound();


  // Optional: hide inactive items from public users
  // If you want employees/admins to still view, handle that separately.
  if (!product.is_active) notFound();

  const images = getAllImages(product);
  const price = formatPrice(product.price);
  const soldOut = product.quantity !== null && product.quantity <= 0;

  return (
    <main className={styles.page}>
      <ScrollToTop />
      <div className={styles.layout}>
        <section className={styles.left}>
          <ImageGallery images={images} alt={product.name} />
        </section>

        <section className={styles.right}>
          <h1 className={styles.title}>{product.name}</h1>

          <div className={styles.priceRow}>
            <div className={styles.price}>{price}</div>
            {soldOut && <div className={styles.badge}>Sold</div>}
          </div>

          {product.description && (
            <p className={styles.desc}>{product.description}</p>
          )}

          <div className={styles.ctaWrap}>
            <AddToCartButton
              soldOut={soldOut}
              maxQty={product.quantity}
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url ?? null,
              }}
            />
          </div>

          {/* “Details” like the screenshot (simple dash list) */}
          <ul className={styles.details}>
            {product.category && <li>Category: {product.category}</li>}
            {product.condition && <li>Condition: {product.condition}</li>}

            {product.height != null && <li>Height: {product.height}</li>}
            {product.width != null && <li>Width: {product.width}</li>}
            {product.depth != null && <li>Depth: {product.depth}</li>}

            {product.sku && <li>SKU: {product.sku}</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
