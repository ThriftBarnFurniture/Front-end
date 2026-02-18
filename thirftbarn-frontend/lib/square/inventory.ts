const SQUARE_API_BASE = "https://connect.squareup.com/v2";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function squareFetch(path: string, init: RequestInit) {
  const token = requireEnv("SQUARE_ACCESS_TOKEN");
  const res = await fetch(`${SQUARE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.detail || json?.errors?.[0]?.code || `Square API error (${res.status})`;
    throw new Error(`${msg} :: ${path}`);
  }
  return json;
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
