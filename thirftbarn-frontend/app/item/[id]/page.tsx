import { notFound } from "next/navigation";
import styles from "./item.module.css";
import ImageGallery from "./ImageGallery";
import { formatPrice, getAllImages, getProductById } from "@/lib/products";
import AddToCartButton from "@/components/cart/AddToCartButton";
import ScrollToTop from "../../../components/ui/ScrollToTop";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await getProductById(id);
  if (!product) notFound();

  // Hide inactive items from public users
  if (!product.is_active) notFound();

  const images = getAllImages(product);

  const currentPriceNum =
    product.price != null ? Number(product.price) : null;
    
  const initialPriceNum =
    (product as any).initial_price != null
      ? Number((product as any).initial_price)
      : null;

  const showDropped =
    currentPriceNum != null &&
    initialPriceNum != null &&
    currentPriceNum < initialPriceNum;

  const price = currentPriceNum != null ? formatPrice(currentPriceNum) : "";
  const oldPrice = showDropped && initialPriceNum != null ? formatPrice(initialPriceNum) : null;

  const soldOut = product.quantity !== null && product.quantity <= 0;

  // Optional: program badges (purely display)
  const isBarnBurner = Boolean((product as any).is_barn_burner);
  const isMonthlyDrop = Boolean((product as any).is_monthly_price_drop);

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
            {showDropped ? (
              <>
                <div className={styles.oldPrice}>{oldPrice}</div>
                <div className={styles.price}>{price}</div>
                <div className={styles.dropBadge}>Price dropped</div>
              </>
            ) : (
              <div className={styles.price}>{price}</div>
            )}

            {/* Program badges (optional, remove if you don't want them) */}
            {isBarnBurner && <div className={styles.dropBadge}>Barn Burner</div>}
            {!isBarnBurner && isMonthlyDrop && <div className={styles.dropBadge}>Monthly Drop</div>}

            {soldOut && <div className={styles.badge}>Sold</div>}
          </div>

          {product.description && <p className={styles.desc}>{product.description}</p>}

          <div className={styles.ctaWrap}>
            <AddToCartButton
              soldOut={soldOut}
              maxQty={product.quantity}
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url ?? null,
                is_oversized: Boolean((product as any).is_oversized),
              }}
            />
          </div>

          <ul className={styles.details}>
            {product.category && <li>Category: {product.category.join(", ")}</li>}
            {product.subcategory && <li>Subcategory: {product.subcategory.join(", ")}</li>}

            {Array.isArray((product as any).room_tags) && (product as any).room_tags.length > 0 && (
              <li>Room Tags: {(product as any).room_tags.join(", ")}</li>
            )}
            {typeof (product as any).room_tags === "string" && (product as any).room_tags && (
              <li>Room Tags: {(product as any).room_tags}</li>
            )}

            {Array.isArray((product as any).collections) && (product as any).collections.length > 0 && (
              <li>Collections: {(product as any).collections.join(", ")}</li>
            )}
            {typeof (product as any).collections === "string" && (product as any).collections && (
              <li>Collections: {(product as any).collections}</li>
            )}

            {Array.isArray((product as any).colors) && (product as any).colors.length > 0 && (
              <li>Colors: {(product as any).colors.join(", ")}</li>
            )}
            {typeof (product as any).colors === "string" && (product as any).colors && (
              <li>Colors: {(product as any).colors}</li>
            )}

            {product.condition && <li>Condition: {product.condition}</li>}

            {(() => {
              const h = product.height ?? null;
              const w = product.width ?? null;
              const d = product.depth ?? null;

              const parts = [
                h != null ? `H ${h}"` : null,
                w != null ? `W ${w}"` : null,
                d != null ? `D ${d}"` : null,
              ].filter(Boolean) as string[];

              if (parts.length === 0) return null;

              return <li>Dimensions: {parts.join(" × ")}</li>;
            })()}
          </ul>
        </section>
      </div>
    </main>
  );
}
