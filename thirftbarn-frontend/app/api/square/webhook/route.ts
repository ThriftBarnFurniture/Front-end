import { NextResponse } from "next/server";
import crypto from "crypto";
import { isUnlimitedQuantity } from "@/lib/inventory";
import { createAdminClient } from "../../../../utils/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30; // Give it time for multiple DB operations

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySquareSignature(rawBody: string, signatureHeader: string | null) {
  const key = (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "").trim();
  // ✅ Use a hardcoded URL from env — req.url can differ from what Square sees
  const webhookUrl = (process.env.SQUARE_WEBHOOK_URL || "").trim();
  
  if (!key || !webhookUrl) {
    throw new Error("Missing SQUARE_WEBHOOK_SIGNATURE_KEY or SQUARE_WEBHOOK_URL");
  }
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", key)
    .update(webhookUrl + rawBody, "utf8")
    .digest("base64");

  return timingSafeEqual(expected, signatureHeader.trim());
}

type InventoryCount = {
  catalog_object_id?: string;
  location_id?: string;
  state?: string;
  quantity?: string;
};

export async function POST(req: Request) {
  let rawBody = "";
  let event: { type?: string; merchant_id?: string; data?: { object?: { inventory_counts?: InventoryCount[]; inventory_count?: InventoryCount } } } | null;

  try {
    rawBody = await req.text();
    const signature = req.headers.get("x-square-hmacsha256-signature");

    if (!signature) {
      return new NextResponse("Missing signature", { status: 400 });
    }
    
    if (!verifySquareSignature(rawBody, signature)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    event = rawBody ? JSON.parse(rawBody) : null;
  } catch (err: unknown) {
    return new NextResponse(`Webhook Error: ${err instanceof Error ? err.message : "Invalid event"}`, { status: 400 });
  }

  // ✅ Merchant gate (optional)
  const allowedMerchant = (process.env.SQUARE_MERCHANT_ID || "").trim();
  if (allowedMerchant && event?.merchant_id && event.merchant_id !== allowedMerchant) {
    return NextResponse.json({ received: true, skipped: "wrong merchant" });
  }

  // ✅ Only handle inventory updates — return 200 for other events so Square doesn't retry
  if (event?.type !== "inventory.count.updated") {
    return NextResponse.json({ received: true, skipped: event?.type });
  }

  // ✅ Now do the actual work BEFORE returning
  try {
    const locationId = (process.env.SQUARE_LOCATION_ID || "").trim() || null;

    const counts: InventoryCount[] =
      event?.data?.object?.inventory_counts ||
      (event?.data?.object?.inventory_count ? [event.data.object.inventory_count] : []);

    if (!Array.isArray(counts) || counts.length === 0) {
      return NextResponse.json({ received: true, skipped: "no counts" });
    }

    const supabase = createAdminClient();

    let failed = false;
    for (const c of counts) {
      const variationId = c.catalog_object_id;
      const countLocation = c.location_id;
      const state = c.state;
      const qtyStr = c.quantity;

      // Skip if wrong location
      if (locationId && countLocation && countLocation !== locationId) continue;
      // Skip if not IN_STOCK or missing data
      if (!variationId || state !== "IN_STOCK" || !qtyStr) continue;

      const newQty = Number(qtyStr);
      if (!Number.isSafeInteger(newQty) || newQty < 0) continue;

      const { data: prod, error: findErr } = await supabase
        .from("products")
        .select("id, quantity")
        .eq("square_variation_id", variationId)
        .maybeSingle();

      if (findErr) {
        console.error("Square product lookup failed:", findErr.message);
        failed = true;
        continue;
      }
      if (!prod) {
        console.log(`Square webhook: No product found for variation ${variationId}`);
        continue;
      }

      if (isUnlimitedQuantity(prod.quantity)) continue;

      const { error: upErr } = await supabase
        .from("products")
        .update({
          quantity: newQty,
          is_active: newQty > 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prod.id);

      if (upErr) {
        failed = true;
        console.error(`Square webhook: Failed to update product ${prod.id}:`, upErr.message);
      } else {
        console.log(`Square webhook: Updated ${prod.id} quantity to ${newQty}`);
      }
    }

    if (failed) return new NextResponse("Inventory update failed; please retry.", { status: 500 });
    return NextResponse.json({ received: true, processed: counts.length });
  } catch (e: unknown) {
    console.error("Square webhook processing failed:", e instanceof Error ? e.message : e);
    // Return 500 so Square retries (your logic should be idempotent)
    return new NextResponse("Processing error", { status: 500 });
  }
}

