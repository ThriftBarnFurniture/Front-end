"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/cart";
import { readCart, writeCart, clearCartStorage } from "@/lib/cart";

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number; // display only
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQty: (productId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage on first mount
  useEffect(() => {
    setItems(readCart());
  }, []);

  // Persist whenever items change
  useEffect(() => {
    writeCart(items);
  }, [items]);

  const addItem: CartContextValue["addItem"] = (item, quantity = 1) => {
    setItems((prev) => {
      const qty = Math.max(1, Math.floor(quantity));
      const existing = prev.find((p) => p.productId === item.productId);
      if (existing) {
        return prev.map((p) =>
          p.productId === item.productId ? { ...p, quantity: p.quantity + qty } : p
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  };

  const removeItem: CartContextValue["removeItem"] = (productId) => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
  };

  const setQty: CartContextValue["setQty"] = (productId, quantity) => {
    const qty = Math.max(1, Math.floor(quantity || 1));
    setItems((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, quantity: qty } : p))
    );
  };

  const clear = () => {
    setItems([]);
    clearCartStorage();
  };

  const totalItems = useMemo(
    () => items.reduce((acc, it) => acc + it.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + it.price * it.quantity, 0),
    [items]
  );

  const value: CartContextValue = {
    items,
    totalItems,
    subtotal,
    addItem,
    removeItem,
    setQty,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
