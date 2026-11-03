export type CheckoutItem = { productId: string; quantity: number };
export type OrderItemSnapshot = { product_id: string; quantity: number; unit_price_cents: number; name: string };

export class CheckoutValidationError extends Error {}

export function normalizeCheckoutItems(input: unknown): CheckoutItem[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50) {
    throw new CheckoutValidationError("Your cart must contain between 1 and 50 items.");
  }
  const quantities = new Map<string, number>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") throw new CheckoutValidationError("Invalid cart item.");
    const { productId, quantity } = entry as Record<string, unknown>;
    if (typeof productId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
      throw new CheckoutValidationError("Invalid product in cart.");
    }
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999) {
      throw new CheckoutValidationError("Item quantities must be whole numbers between 1 and 999999.");
    }
    const id = productId.toLowerCase();
    const total = (quantities.get(id) ?? 0) + quantity;
    if (total > 999999) throw new CheckoutValidationError("Item quantity is too large.");
    quantities.set(id, total);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

export function readOrderItemSnapshot(raw: unknown): OrderItemSnapshot[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error("Order item snapshot is missing.");
  return raw.map((entry) => {
    const item = (typeof entry === "string" ? JSON.parse(entry) : entry) as OrderItemSnapshot;
    if (!item || typeof item.product_id !== "string" || typeof item.name !== "string" ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
        !Number.isSafeInteger(item.unit_price_cents) || item.unit_price_cents < 0) {
      throw new Error("Order item snapshot is invalid.");
    }
    return item;
  });
}

export function validatePaymentSnapshot(args: {
  items: OrderItemSnapshot[];
  wanted: CheckoutItem[];
  subtotal: number | string | null;
  total: number | string | null;
  currency: string | null;
  amountTotal: number | null;
  paymentCurrency: string | null;
}) {
  const stored = normalizeCheckoutItems(args.items.map(item => ({ productId: item.product_id, quantity: item.quantity })));
  const wanted = new Map(args.wanted.map(item => [item.productId, item.quantity]));
  if (stored.length !== wanted.size || stored.some(item => wanted.get(item.productId) !== item.quantity)) {
    throw new Error("Payment cart does not match the order snapshot.");
  }
  const subtotal = args.items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
  if (!Number.isSafeInteger(subtotal) || args.subtotal == null || Math.round(Number(args.subtotal) * 100) !== subtotal ||
      args.total == null || !Number.isSafeInteger(args.amountTotal) || Math.round(Number(args.total) * 100) !== args.amountTotal ||
      !args.currency || args.currency.toLowerCase() !== args.paymentCurrency?.toLowerCase()) {
    throw new Error("Payment amount does not match the order snapshot.");
  }
}

export function isPaymentSettled(status: string, amount: number | null) {
  return status === "paid" || (status === "no_payment_required" && amount === 0);
}
