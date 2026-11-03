export type CartItem = {
  productId: string; // uuid
  name: string;
  imageUrl?: string | null;
  price: number; // display only (NOT trusted at checkout)
  quantity: number;
  is_oversized?: boolean;
};

const STORAGE_KEY = "tb_cart_v1";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A stale or damaged browser entry must not crash every page through the
    // shared cart provider. Preserve valid lines, including older cart formats.
    return parsed.filter((item: unknown): item is CartItem => {
      if (!item || typeof item !== "object") return false;
      const line = item as Partial<CartItem>;
      return typeof line.productId === "string" && line.productId.length > 0 &&
        typeof line.name === "string" &&
        typeof line.price === "number" && Number.isFinite(line.price) && line.price >= 0 &&
        typeof line.quantity === "number" && Number.isSafeInteger(line.quantity) && line.quantity > 0 &&
        (line.imageUrl == null || typeof line.imageUrl === "string");
    });
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable or full. The current in-memory cart still works.
  }
}

export function clearCartStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing the in-memory cart must also work when browser storage is blocked.
  }
}
