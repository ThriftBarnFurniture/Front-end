"use client";

import { useEffect, useState } from "react";
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
  const { addItem, toast } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const priceNumber =
    typeof product.price === "string" ? Number(product.price) : product.price;

  const isDisabled = disabled || !Number.isFinite(priceNumber);

  useEffect(() => {
    if (!justAdded) return;
    const t = window.setTimeout(() => setJustAdded(false), 900);
    return () => window.clearTimeout(t);
  }, [justAdded]);

  const onClick = () => {
    addItem(
      {
        productId: product.id,
        name: product.name,
        price: Number.isFinite(priceNumber) ? priceNumber : 0,
        imageUrl: product.image_url ?? null,
      },
      quantity
    );

    setJustAdded(true);
    toast(`Added to cart ✅ ${quantity > 1 ? `(${quantity})` : ""}`);
  };

  return (
    <button
      type="button"
      className={`${styles.btn} ${justAdded ? styles.btnAdded : ""}`}
      disabled={isDisabled}
      onClick={onClick}
    >
      {justAdded ? "Added ✅" : "Add to Cart"}
    </button>
  );
}
