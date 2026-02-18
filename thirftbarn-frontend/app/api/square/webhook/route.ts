
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
  const rawBody = await req.text();
  const signature = req.headers.get("x-square-hmacsha256-signature");

  // TEMP DEBUG — remove after it works
  const key = (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "").trim();
  const url = (process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || "").trim();

  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature header", bodyLen: rawBody.length },
      { status: 401 }
    );
  }

  if (!key || !url) {
    return NextResponse.json(
      { error: "Missing env", hasKey: !!key, hasUrl: !!url },
      { status: 500 }
    );
  }

  const expected = crypto
    .createHmac("sha256", key)
    .update(url + rawBody, "utf8")
    .digest("base64");

  if (!timingSafeEqual(expected, signature)) {
    return NextResponse.json(
      {
        error: "Invalid signature",
        urlUsed: url,
        bodyLen: rawBody.length,
        sigPrefix: signature.slice(0, 10),
        expPrefix: expected.slice(0, 10),
      },
      { status: 401 }
    );
  }

  // ✅ if we get here, signature is verified
  return NextResponse.json({ ok: true, verified: true });
}
