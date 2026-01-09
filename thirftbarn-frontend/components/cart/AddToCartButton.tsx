"use client";

import { useCart } from "@/components/cart/CartProvider";
import styles from "./add-to-cart.module.css";

type Props = {
  product: {
    id: string;
    name: string;
    price: string | number;
    image_url?: string | null;
  };
  quantity?: number;
  disabled?: boolean;
};

export default function AddToCartButton({ product, quantity = 1, disabled }: Props) {
  const { addItem } = useCart();

  const priceNumber =
    typeof product.price === "string" ? Number(product.price) : product.price;

  const isDisabled = disabled || !Number.isFinite(priceNumber);

  return (
    <button
      type="button"
      className={styles.btn}
      disabled={isDisabled}
      onClick={() =>
        addItem(
          {
            productId: product.id,
            name: product.name,
            price: Number.isFinite(priceNumber) ? priceNumber : 0,
            imageUrl: product.image_url ?? null,
          },
          quantity
        )
      }
    >
      Add to Cart
    </button>
  );
}
