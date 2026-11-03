import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { receiptCookieName, verifyReceiptToken } from "@/lib/receipt-token";
import { rateLimitRequest } from "@/lib/request-limits";

export async function POST(req: Request) {
  const limited = rateLimitRequest(req, "receipt", 30, 60_000);
  if (limited) return limited;
  try {
    const { sessionId } = (await req.json()) as { sessionId?: string };
    const sid = String(sessionId ?? "").trim();
    if (!/^cs_(test_|live_)?[a-zA-Z0-9]+$/.test(sid) || sid.length > 255) return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });

    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_id,user_id,order_number,status,currency,subtotal,tax,total,purchase_date,items,customer_name,customer_email,customer_phone,shipping_address,shipping_cost,promo_code,promo_discount,stripe_email,stripe_session_id"
      )
      .eq("stripe_session_id", sid)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ order: null }, { status: 200 });

    const cookie = (await cookies()).get(receiptCookieName(sid))?.value;
    let privateAccess = verifyReceiptToken(cookie, sid, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    if (!privateAccess && data.user_id) {
      const client = await createClient();
      const { data: auth } = await client.auth.getUser();
      privateAccess = auth.user?.id === data.user_id;
    }
    // Keep old guest confirmation links usable, but never expose personal
    // details from session-ID possession alone.
    const { user_id: _userId, stripe_session_id: _sessionId, ...receipt } = data;
    if (!privateAccess) {
      receipt.customer_name = null;
      receipt.customer_email = null;
      receipt.customer_phone = null;
      receipt.shipping_address = null;
      receipt.stripe_email = null;
    }
    return NextResponse.json({ order: { ...receipt, private_details_available: privateAccess } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: unknown) {
    console.error("Receipt lookup failed:", e);
    return NextResponse.json({ error: "Unable to load this receipt." }, { status: 500 });
  }
}
