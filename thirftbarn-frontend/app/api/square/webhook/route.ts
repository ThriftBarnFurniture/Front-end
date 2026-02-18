import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import crypto from "crypto";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Square: signature = base64( HMAC_SHA256(key, notificationUrl + body) )
 * Compare to header: x-square-hmacsha256-signature
 */
function verifySquareSignature(rawBody: string, signatureHeader: string | null) {
  const key = requireEnv("SQUARE_WEBHOOK_SIGNATURE_KEY");
  const notificationUrl = requireEnv("SQUARE_WEBHOOK_NOTIFICATION_URL");

  if (!signatureHeader) return false;

  const payload = notificationUrl + rawBody;

  const expected = crypto
    .createHmac("sha256", key)
    .update(payload, "utf8")
    .digest("base64");

  return timingSafeEqual(expected, signatureHeader);
}

type InventoryCount = {
  catalog_object_id?: string; // Square variation id
  location_id?: string;
  state?: string; // IN_STOCK, SOLD, etc.
  quantity?: string; // string in Square payload
};

export async function POST(req: Request) {
  const rawBody = await req.text(); // IMPORTANT: verify using RAW body :contentReference[oaicite:1]{index=1}
  const signature = req.headers.get("x-square-hmacsha256-signature");

  if (!verifySquareSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // Example event type: "inventory.count.updated" :contentReference[oaicite:2]{index=2}
  const eventType: string | undefined = event?.type;

  // Always ACK quickly for non-inventory events (you can expand later)
  if (eventType !== "inventory.count.updated") {
    return NextResponse.json({ ok: true, ignored: true, type: eventType });
  }

  const locationId = process.env.SQUARE_LOCATION_ID || null;

  const counts: InventoryCount[] =
    event?.data?.object?.inventory_counts ||
    event?.data?.object?.inventory_count ||
    [];

  if (!Array.isArray(counts) || counts.length === 0) {
    return NextResponse.json({ ok: true, note: "No inventory counts in payload" });
  }

  const supabase = await createClient();

  let updated = 0;
  let skipped = 0;

  for (const c of counts) {
    const variationId = c.catalog_object_id;
    const countLocation = c.location_id;
    const state = c.state;
    const qtyStr = c.quantity;

    // Only process your location if provided
    if (locationId && countLocation && countLocation !== locationId) {
      skipped++;
      continue;
    }

    // We treat IN_STOCK as the count that maps to your website "quantity"
    if (!variationId || state !== "IN_STOCK" || !qtyStr) {
      skipped++;
      continue;
    }

    const newQty = Number.parseInt(qtyStr, 10);
    if (!Number.isFinite(newQty) || newQty < 0) {
      skipped++;
      continue;
    }

    // Find product by square_variation_id
    const { data: prod, error: findErr } = await supabase
      .from("products")
      .select("id, quantity")
      .eq("square_variation_id", variationId)
      .maybeSingle();

    if (findErr || !prod) {
      skipped++;
      continue;
    }

    const oldQty = prod.quantity ?? 0;
    const delta = newQty - oldQty;

    // Update product quantity (and optionally auto-deactivate when 0)
    const { error: upErr } = await supabase
      .from("products")
      .update({
        quantity: newQty,
        is_active: newQty > 0, // comment this out if you don’t want auto deactivation
      })
      .eq("id", prod.id);

    if (upErr) {
      skipped++;
      continue;
    }

    // Log event
    await supabase.from("inventory_events").insert({
      product_id: prod.id,
      delta,
      reason: "square_inventory_webhook",
      source: "square",
      order_id: null,
    });

    updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped });
}
