const UNLIMITED_QUANTITY_SENTINEL = 999999999;
const UNLIMITED_QUANTITY_THRESHOLD = 1000000;

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;

  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeQuantity(value: unknown): number | null {
  const quantity = toFiniteNumber(value);
  if (quantity == null) return null;
  if (quantity >= UNLIMITED_QUANTITY_THRESHOLD) return null;
  return quantity;
}

export function toStoredQuantity(value: number | null): number {
  if (value == null) return UNLIMITED_QUANTITY_SENTINEL;
  return Math.max(0, Math.floor(value));
}

export function isUnlimitedQuantity(value: unknown) {
  return normalizeQuantity(value) == null;
}

export function isOutOfStock(value: unknown) {
  const quantity = normalizeQuantity(value);
  return typeof quantity === "number" && quantity <= 0;
}
