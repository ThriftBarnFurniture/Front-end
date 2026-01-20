"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import styles from "./add-to-cart.module.css";

type Props = {
  product: {
    id: string;
    name: string;
    price: string | number;
    image_url?: string | null;
  };

  disabled?: boolean;
  soldOut?: boolean;
  maxQty?: number | null; // from DB (e.g. 3). null = no cap
};

export default function AddToCartButton({
  product,
  disabled,
  soldOut = false,
  maxQty = null,
}: Props) {
  const { addItem, removeItem, toast, items } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [qtyInput, setQtyInput] = useState(1);

  const priceNumber =
    typeof product.price === "string" ? Number(product.price) : product.price;

  const isDisabledBase = disabled || !Number.isFinite(priceNumber);

  const inCartQty = useMemo(() => {
    const found = items.find((i) => i.productId === product.id);
    return found?.quantity ?? 0;
  }, [items, product.id]);

  const remaining = useMemo(() => {
    if (typeof maxQty !== "number") return Infinity; // no cap
    return Math.max(0, maxQty - inCartQty);
  }, [maxQty, inCartQty]);

  // keep the quantity input within allowed bounds as cart changes
  useEffect(() => {
    if (!Number.isFinite(remaining)) return;
    setQtyInput((prev) => Math.max(1, Math.min(prev, Math.max(1, remaining))));
  }, [remaining]);

  useEffect(() => {
    if (!justAdded) return;
    const t = window.setTimeout(() => setJustAdded(false), 900);
    return () => window.clearTimeout(t);
  }, [justAdded]);

  const onAdd = () => {
    if (soldOut) return;
    if (isDisabledBase) return;

    const requested = Math.max(1, Math.floor(qtyInput || 1));
    const canAdd = Number.isFinite(remaining)
      ? Math.min(requested, remaining)
      : requested;

    if (canAdd <= 0) {
      toast("You already have the max available stock in your cart.");
      return;
    }

    addItem(
      {
        productId: product.id,
        name: product.name,
        price: Number.isFinite(priceNumber) ? priceNumber : 0,
        imageUrl: product.image_url ?? null,
      },
      canAdd
    );

    if (Number.isFinite(remaining) && canAdd < requested) {
      toast("Capped to available stock.");
    } else {
      toast(`Added to cart ✅ ${canAdd > 1 ? `(${canAdd})` : ""}`);
    }

    setJustAdded(true);
  };

  const onRemove = () => {
    removeItem(product.id);
    toast("Removed from cart 🗑️");
  };

  const addLabel = soldOut
    ? "Out of Stock"
    : Number.isFinite(remaining) && remaining <= 0
      ? "Max in cart"
      : justAdded
        ? "Added ✅"
        : "Add to Cart";

  return (
    <div className={styles.wrap}>
      {/* Qty field */}
      {!soldOut && (
        <label className={styles.qtyWrap}>
          <span className={styles.qtyLabel}>Qty</span>
          <input
            className={styles.qtyInput}
            type="number"
            min={1}
            max={Number.isFinite(remaining) ? Math.max(1, remaining) : undefined}
            value={qtyInput}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const next = Number.isFinite(raw) ? Math.floor(raw) : 1;
              const capped = Number.isFinite(remaining)
                ? Math.max(1, Math.min(next, Math.max(1, remaining)))
                : Math.max(1, next);
              setQtyInput(capped);
            }}
          />
        </label>
      )}

      {/* Add stays visible always */}
      <button
        type="button"
        className={`addToCartCta ${styles.btn} ${justAdded ? styles.btnAdded : ""}`}
        disabled={isDisabledBase}
        onClick={onAdd}
      >
        {addLabel}
      </button>

      {/* Helper text + tiny remove button */}
      {typeof maxQty === "number" && !soldOut && (
        <div className={styles.stockRow}>
          <div className={styles.stockText}>
            In cart: {inCartQty} / {Math.max(0, maxQty)}
          </div>

          {inCartQty > 0 && (
            <button
              type="button"
              className={styles.removeTiny}
              onClick={onRemove}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
