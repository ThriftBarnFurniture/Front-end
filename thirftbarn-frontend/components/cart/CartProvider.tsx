"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem } from "@/lib/cart";
import { readCart, writeCart, clearCartStorage } from "@/lib/cart";

type CartToast = { id: string; message: string };

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQty: (productId: string, quantity: number) => void;
  clear: () => void;

  // NEW: feedback/toast
  toast: (message: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [toasts, setToasts] = useState<CartToast[]>([]);

  useEffect(() => {
    setItems(readCart());
  }, []);

  useEffect(() => {
    writeCart(items);
  }, [items]);

  const toast = useCallback((message: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  const addItem = useCallback<CartContextValue["addItem"]>((item, quantity = 1) => {
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
  }, []);

  const removeItem = useCallback<CartContextValue["removeItem"]>((productId) => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
  }, []);

  const setQty = useCallback<CartContextValue["setQty"]>((productId, quantity) => {
    const qty = Math.max(1, Math.floor(quantity || 1));
    setItems((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, quantity: qty } : p))
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    clearCartStorage();
  }, []);

  const totalItems = useMemo(
    () => items.reduce((acc, it) => acc + it.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + it.price * it.quantity, 0),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, totalItems, subtotal, addItem, removeItem, setQty, clear, toast }),
    [items, totalItems, subtotal, addItem, removeItem, setQty, clear, toast]
  );

  return (
    <CartContext.Provider value={value}>
      {children}

      {/* NEW: simple toast stack */}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            display: "grid",
            gap: 10,
            zIndex: 999999,
          }}
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(0,0,0,0.85)",
                color: "white",
                fontWeight: 800,
                boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                maxWidth: 320,
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
