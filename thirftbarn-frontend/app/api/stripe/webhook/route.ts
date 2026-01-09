import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import Stripe from "stripe";

function parsePackedCart(packed: string) {
  // packed = "uuid:2,uuid:1"
  if (!packed) return [];
  return packed
    .split(",")
    .map((pair) => {
      const [productId, qty] = pair.split(":");
      return {
        productId,
        quantity: Math.max(1, Math.floor(Number(qty || 1))),
      };
    })
    .filter((x) => x.productId);
}

export async function POST(req: Request) {
  const webhookSecret = process.env.DEV_STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new NextResponse("Missing DEV_STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Idempotency: if we already created an order for this session, skip
      const supabase = createSupabaseAdmin();

      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (existing?.id) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      const packed = session.metadata?.cart || "";
      const wanted = parsePackedCart(packed);

      if (!wanted.length) {
        // You can still store an order with no items, but usually this indicates a bug.
        throw new Error("No cart metadata found on session.");
      }

      const ids = wanted.map((w) => w.productId);

      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id,name,price,image_url,quantity,is_active")
        .in("id", ids);

      if (pErr) throw new Error(pErr.message);
      if (!products || !products.length) throw new Error("Products not found for order.");

      const pMap = new Map(products.map((p) => [p.id, p]));

      // Validate availability again (best effort)
      for (const w of wanted) {
        const p = pMap.get(w.productId);
        if (!p) throw new Error("Missing product in webhook validation.");
        if (!p.is_active) throw new Error(`Inactive product purchased: ${p.name}`);
        if (typeof p.quantity === "number" && p.quantity < w.quantity) {
          throw new Error(`Oversell detected for: ${p.name}`);
        }
      }

      const amount_total = session.amount_total ?? 0;
      const currency = session.currency ?? "cad";
      const email = session.customer_details?.email ?? session.customer_email ?? null;

      // Create order
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent ?? null,
          email,
          amount_total,
          currency,
          status: "paid",
        })
        .select("id")
        .single();

      if (oErr) throw new Error(oErr.message);

      // Create order items (snapshot)
      const orderItems = wanted.map((w) => {
        const p = pMap.get(w.productId)!;
        return {
          order_id: order.id,
          product_id: p.id,
          name: p.name,
          unit_price: Number(p.price),
          quantity: w.quantity,
          image_url: p.image_url ?? null,
        };
      });

      const { error: oiErr } = await supabase.from("order_items").insert(orderItems);
      if (oiErr) throw new Error(oiErr.message);

      // Decrement inventory
      // If you want stronger concurrency safety, do this with an RPC in SQL.
      for (const w of wanted) {
        const p = pMap.get(w.productId)!;
        const newQty = (Number(p.quantity) || 0) - w.quantity;

        const { error: updErr } = await supabase
          .from("products")
          .update({ quantity: newQty })
          .eq("id", w.productId);

        if (updErr) throw new Error(updErr.message);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    // Returning 200 prevents Stripe from retrying forever.
    // If you want retries for failures, return 500 instead.
    return new NextResponse(`Webhook handler error: ${err.message}`, { status: 200 });
  }
}
