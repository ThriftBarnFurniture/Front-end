import { squareFetch } from "@/lib/square";
import { createHash } from "node:crypto";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/** Record an external sale as a delta so concurrent POS sales are preserved. */
export async function recordSquareSale(args: {
  variationId: string; quantity: number; sessionId: string; productId: string; occurredAt: string;
}) {
  if (!Number.isSafeInteger(args.quantity) || args.quantity <= 0) throw new Error("Invalid Square sale quantity");
  const locationId = requireEnv("SQUARE_LOCATION_ID");
  const signal = AbortSignal.timeout(8000);
  const key = createHash("sha256").update(`${args.sessionId}:${args.productId}`).digest("hex");
  const adjustment = await squareFetch("/inventory/changes/batch-create", {
    method: "POST", signal,
    body: JSON.stringify({
      idempotency_key: `stripe_sale_${key}`,
      changes: [{ type: "ADJUSTMENT", adjustment: {
        catalog_object_id: args.variationId, location_id: locationId,
        from_state: "IN_STOCK", to_state: "SOLD", quantity: String(args.quantity),
        occurred_at: args.occurredAt,
      } }],
    }),
  });
  if (adjustment?.errors?.length) throw new Error("Square sale adjustment was rejected");
  // Idempotent replays may return the original response. Read a fresh count so
  // POS activity since that response is included in database reconciliation.
  const result = await squareFetch("/inventory/counts/batch-retrieve", {
    method: "POST", signal,
    body: JSON.stringify({ catalog_object_ids: [args.variationId], location_ids: [locationId], states: ["IN_STOCK"] }),
  }) as { counts?: Array<{ catalog_object_id?: string; location_id?: string; state?: string; quantity?: string; calculated_at?: string }> } | null;
  const count = result?.counts?.find(item => item.catalog_object_id === args.variationId && item.location_id === locationId && item.state === "IN_STOCK");
  const quantity = Number(count?.quantity);
  if (!count?.calculated_at || !Number.isSafeInteger(quantity) || quantity < 0 || !Number.isFinite(Date.parse(count.calculated_at))) {
    throw new Error("Square inventory count could not be confirmed");
  }
  return { quantity, calculatedAt: count.calculated_at };
}

export async function setSquareInStockCount(args: {
  variationId: string;
  newQty: number;
  idempotencyKey: string;
  occurredAt?: string;
  signal?: AbortSignal;
}) {
  const locationId = requireEnv("SQUARE_LOCATION_ID");
  const qty = Math.max(0, Math.floor(args.newQty));

  return squareFetch("/inventory/batch-change", {
    method: "POST",
    signal: args.signal,
    body: JSON.stringify({
      idempotency_key: args.idempotencyKey,
      changes: [
        {
          type: "PHYSICAL_COUNT",
          physical_count: {
            catalog_object_id: args.variationId,
            location_id: locationId,
            state: "IN_STOCK",
            quantity: String(qty),
            occurred_at: args.occurredAt ?? new Date().toISOString(),
          },
        },
      ],
    }),
  });
}
