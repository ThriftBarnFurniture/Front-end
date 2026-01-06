/*
Creates a Stripe Checkout Session:

Accepts { items: [{id, qty}] }

Re-reads product prices from Supabase (never trust client price)

Builds Stripe line_items

Returns { url } for Stripe-hosted checkout
*/

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const { items } = await req.json() as { items: { id: string; qty: number }[] };

  const supabase = await createClient();

  // verify products + prices from DB (never trust client)
  const ids = items.map((i) => i.id);
  const { data: products } = await supabase
    .from("products")
    .select("id,name,price_cents,currency,is_active")
    .in("id", ids)
    .eq("is_active", true);

  const map = new Map((products ?? []).map((p) => [p.id, p]));

  const line_items = items
    .filter((i) => map.has(i.id) && i.qty > 0)
    .map((i) => {
      const p = map.get(i.id)!;
      return {
        quantity: i.qty,
        price_data: {
          currency: p.currency,
          product_data: { name: p.name },
          unit_amount: p.price_cents,
        },
      };
    });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    success_url: `${siteUrl}/checkout?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cart?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
