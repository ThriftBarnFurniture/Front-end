import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "../../../../utils/supabase/admin";

export const runtime = "nodejs";

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySquareSignature(rawBody: string, signatureHeader: string | null, reqUrl: string) {
  const key = (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "").trim();
  if (!key) throw new Error("Missing SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!signatureHeader) return false;

  const sig = signatureHeader.trim();

  // Use the exact URL Square called (avoids env mismatch issues)
  const expected = crypto
    .createHmac("sha256", key)
    .update(reqUrl + rawBody, "utf8")
    .digest("base64");

  return timingSafeEqual(expected, sig);
}

type InventoryCount = {
  catalog_object_id?: string;
  location_id?: string;
  state?: string;
  quantity?: string;
};

export async function POST(req: Request) {
  let rawBody = "";
  let event: any;

  try {
    rawBody = await req.text();
    const signature = req.headers.get("x-square-hmacsha256-signature");

    if (!signature) return new NextResponse("Missing x-square-hmacsha256-signature", { status: 400 });
    if (!verifySquareSignature(rawBody, signature, req.url)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    event = rawBody ? JSON.parse(rawBody) : null;
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err?.message || err}`, { status: 400 });
  }

  // ✅ ACK immediately (like your Stripe route)
  const res = NextResponse.json({ received: true });

  Promise.resolve().then(async () => {
    try {
      // Optional hard-gates
      const allowedMerchant = (process.env.SQUARE_MERCHANT_ID || "").trim();
      if (allowedMerchant && event?.merchant_id && event.merchant_id !== allowedMerchant) return;

      if (event?.type !== "inventory.count.updated") return;

      const locationId = (process.env.SQUARE_LOCATION_ID || "").trim() || null;

      const counts: InventoryCount[] =
        event?.data?.object?.inventory_counts ||
        (event?.data?.object?.inventory_count ? [event.data.object.inventory_count] : []);

      if (!Array.isArray(counts) || counts.length === 0) return;

      const supabase = createAdminClient();

      for (const c of counts) {
        const variationId = c.catalog_object_id;
        const countLocation = c.location_id;
        const state = c.state;
        const qtyStr = c.quantity;

        if (locationId && countLocation && countLocation !== locationId) continue;
        if (!variationId || state !== "IN_STOCK" || !qtyStr) continue;

        const newQty = Number.parseInt(qtyStr, 10);
        if (!Number.isFinite(newQty) || newQty < 0) continue;

        const { data: prod, error: findErr } = await supabase
          .from("products")
          .select("id, quantity")
          .eq("square_variation_id", variationId)
          .maybeSingle();

        if (findErr || !prod) continue;

        const oldQty = prod.quantity ?? 0;
        const delta = newQty - oldQty;

        const { error: upErr } = await supabase
          .from("products")
          .update({
            quantity: newQty,
            is_active: newQty > 0,
          })
          .eq("id", prod.id);

        if (upErr) continue;

        await supabase.from("inventory_events").insert({
          product_id: prod.id,
          delta,
          reason: "square_inventory_webhook",
          source: "square",
          order_id: null,
        });
      }
    } catch (e: any) {
      console.error("Square webhook processing failed:", e?.message || e);
    }
  });

  return res;
}
