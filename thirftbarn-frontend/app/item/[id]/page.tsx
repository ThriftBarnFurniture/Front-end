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

  const dims =
    product.height || product.width || product.depth
      ? `${product.height ?? "—"}H × ${product.width ?? "—"}W × ${product.depth ?? "—"}D`
      : null;

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

          <div className={styles.specs}>
            {product.category && (
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Category</span>
                <span className={styles.specValue}>{product.category}</span>
              </div>
            )}
            {product.condition && (
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Condition</span>
                <span className={styles.specValue}>{product.condition}</span>
              </div>
            )}
            {dims && (
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Dimensions</span>
                <span className={styles.specValue}>{dims}</span>
              </div>
            )}
            {product.sku && (
              <div className={styles.specRow}>
                <span className={styles.specLabel}>SKU</span>
                <span className={styles.specValue}>{product.sku}</span>
              </div>
            )}
            {product.barcode && (
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Barcode</span>
                <span className={styles.specValue}>{product.barcode}</span>
              </div>
            )}
            {product.quantity !== null && (
              <div className={styles.specRow}>
                <span className={styles.specLabel}>In stock</span>
                <span className={styles.specValue}>{Math.max(product.quantity, 0)}</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: "14px" }}>
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
        </section>
      </div>
    </main>
  );
}
