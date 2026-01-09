import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  items: { productId: string; quantity: number }[];
};

function toCents(price: number) {
  // If your Supabase price is already stored in cents, replace with: return Math.round(price);
  return Math.round(price * 100);
}

export async function POST(req: Request) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL");

    const body = (await req.json()) as Body;
    if (!body?.items?.length) {
      return new NextResponse("No items in cart.", { status: 400 });
    }

    // Normalize & validate quantities
    const wanted = body.items
      .map((it) => ({
        productId: String(it.productId),
        quantity: Math.max(1, Math.floor(Number(it.quantity || 1))),
      }))
      .slice(0, 50);

    const ids = wanted.map((w) => w.productId);

    const supabase = createSupabaseAdmin();

    // Fetch products by IDs (server-trusted)
    const { data: products, error } = await supabase
      .from("products")
      .select("id,name,price,quantity,is_active,image_url")
      .in("id", ids);

    if (error) throw new Error(error.message);
    if (!products || products.length === 0) {
      return new NextResponse("Products not found.", { status: 404 });
    }

    // Create a lookup
    const map = new Map(products.map((p) => [p.id, p]));

    // Validate all requested items exist and are purchasable
    for (const w of wanted) {
      const p = map.get(w.productId);
      if (!p) return new NextResponse("One or more products not found.", { status: 404 });
      if (!p.is_active) return new NextResponse(`Item unavailable: ${p.name}`, { status: 400 });
      if (typeof p.quantity === "number" && p.quantity < w.quantity) {
        return new NextResponse(`Not enough stock for: ${p.name}`, { status: 400 });
      }
    }

    // Build Stripe line items from Supabase prices (secure)
    const line_items = wanted.map((w) => {
      const p = map.get(w.productId)!;

      return {
        quantity: w.quantity,
        price_data: {
          currency: "cad",
          unit_amount: toCents(Number(p.price)),
          product_data: {
            name: p.name,
            images: p.image_url ? [p.image_url] : undefined,
          },
        },
      };
    });

    // Store cart in metadata as compact "id:qty,id:qty"
    const packed = wanted.map((w) => `${w.productId}:${w.quantity}`).join(",");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
      metadata: {
        cart: packed,
      },
    });

    if (!session.url) throw new Error("Stripe session missing url.");

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return new NextResponse(err?.message || "Checkout failed.", { status: 500 });
  }
}
