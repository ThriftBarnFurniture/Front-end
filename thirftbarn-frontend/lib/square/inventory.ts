import { squareFetch } from "@/lib/square";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function setSquareInStockCount(args: {
  variationId: string;
  newQty: number;
  idempotencyKey: string;
}) {
  const locationId = requireEnv("SQUARE_LOCATION_ID");
  const qty = Math.max(0, Math.floor(args.newQty));

  return squareFetch("/inventory/batch-change", {
    method: "POST",
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
            occurred_at: new Date().toISOString(),
          },
        },
      ],
    }),
  });
}
