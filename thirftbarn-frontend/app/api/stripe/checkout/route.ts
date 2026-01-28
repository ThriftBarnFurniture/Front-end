import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
// OPTIONAL (recommended): attach logged-in user_id to orders
import { createClient } from "@/utils/supabase/server";

type Body = {
  items: { productId: string; quantity: number }[];
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;

  shipping_method?: "pickup" | "delivery";
  shipping_address?: string; // only required for delivery
  shipping_cost?: number; // optional, default 0

  promo_code?: string;
  promo_discount?: number;
};

type PromoRow = {
  code: string;
  percent_off: number | null;
  amount_off: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toCents(price: number) {
  // If your Supabase price is already stored in cents, replace with: return Math.round(price);
  return Math.round(price * 100);
}

function makeOrderNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TB-${y}${m}${day}-${rand}`;
}

export async function POST(req: Request) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL");

    const body = (await req.json()) as Body;
    if (!body?.items?.length) {
      return new NextResponse("No items in cart.", { status: 400 });
    }
    const customer_name = String(body?.customer_name ?? "").trim();
    const customer_email = String(body?.customer_email ?? "").trim();
    const customer_phone = String(body?.customer_phone ?? "").trim();

    const shipping_method = (body?.shipping_method ?? "") as "pickup" | "delivery" | "";
    const shipping_address = String(body?.shipping_address ?? "").trim();
    const shipping_cost = Number(body?.shipping_cost ?? 0);

    const promo_code = String(body?.promo_code ?? "").trim().toUpperCase();
    const supabase = createSupabaseAdmin();

    // ✅ Server-trusted promo lookup
    let promo_cents = 0;
    let promo_applied_code: string | null = null;

    if (promo_code) {
      const nowIso = new Date().toISOString();

      const { data: promo, error: pErr } = await supabase
        .from("promos")
        .select("code,percent_off,amount_off,starts_at,ends_at,is_active")
        .ilike("code", promo_code)
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .maybeSingle<PromoRow>();

      if (pErr) throw new Error(pErr.message);

      if (promo) {
        promo_applied_code = promo.code; // already uppercase via constraint
        // We'll compute promo_cents later once subtotal/shipping are known
      }
    }

    if (!customer_name || !customer_email || !customer_phone) {
      return NextResponse.json({ error: "Missing checkout info." }, { status: 400 });
    }

    if (shipping_method !== "pickup" && shipping_method !== "delivery") {
      return NextResponse.json({ error: "Missing shipping method." }, { status: 400 });
    }

    if (shipping_method === "delivery" && !shipping_address) {
      return NextResponse.json({ error: "Missing delivery address." }, { status: 400 });
    }



    // Normalize & validate quantities
    const wanted = body.items
      .map((it) => ({
        productId: String(it.productId),
        quantity: Math.max(1, Math.floor(Number(it.quantity || 1))),
      }))
      .slice(0, 50);

    const ids = wanted.map((w) => w.productId);

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

      // quantity === 0 (or less) -> your exact warning
      if (typeof p.quantity === "number" && p.quantity <= 0) {
        return new NextResponse(
          "An item in your cart is out of stock, please remove to continue with purchase.",
          { status: 400 }
        );
      }

      // not enough stock -> keep your existing message (or also change it if you want)
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

    // Build an "items" snapshot for your orders table (jsonb)
    const orderItems = wanted.map((w) => {
      const p = map.get(w.productId)!;
      return {
        product_id: p.id,
        quantity: w.quantity,
        unit_price_cents: toCents(Number(p.price)),
        name: p.name,
      };
    });

    const subtotal_cents = orderItems.reduce(
      (sum, it) => sum + it.unit_price_cents * it.quantity,
      0
    );

    const shipping_cents = Math.max(
      0,
      Math.round((Number.isFinite(shipping_cost) ? shipping_cost : 0) * 100)
    );

    const taxable_base_cents = subtotal_cents + shipping_cents;

    // ✅ compute promo_cents using promo row rules (percent_off OR amount_off)
    if (promo_applied_code) {
      const nowIso = new Date().toISOString();

      // Re-fetch promo row to avoid any earlier logic drift (optional but safe)
      const { data: promo, error: pErr } = await supabase
        .from("promos")
        .select("code,percent_off,amount_off,starts_at,ends_at,is_active")
        .ilike("code", promo_applied_code)
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .maybeSingle<PromoRow>();

      if (pErr) throw new Error(pErr.message);

      if (promo) {
        if (promo.percent_off != null) {
          const pct = clamp(Number(promo.percent_off), 0, 100);
          promo_cents = Math.round((taxable_base_cents * pct) / 100);
        } else if (promo.amount_off != null) {
          promo_cents = Math.round(Number(promo.amount_off) * 100);
        }
      } else {
        // promo expired between request + compute; treat as not applied
        promo_applied_code = null;
        promo_cents = 0;
      }
    }

    // ✅ never discount more than the (subtotal + shipping)
    promo_cents = clamp(promo_cents, 0, taxable_base_cents);
    const tax_cents = 0; // later
    const total_cents = taxable_base_cents - promo_cents + tax_cents;
    
    // ✅ Add shipping as its own Stripe line item so it gets charged
    if (shipping_cents > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: shipping_cents,
          product_data: {
            name: "Shipping",
            images: undefined,
          },
        },
      });
    }

    // OPTIONAL: attach logged-in user_id so it shows in /account/orders
    let userId: string | null = null;
    try {
      const supabaseServer = await createClient();
      const { data } = await supabaseServer.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      // if server auth isn't configured here yet, it's fine
      userId = null;
    }

    // Create pending order FIRST (so webhook updates it)
    const order_number = makeOrderNumber();

    let userEmail: string | null = null;
    try {
      const supabaseServer = await createClient();
      const { data } = await supabaseServer.auth.getUser();
      userId = data.user?.id ?? null;
      userEmail = data.user?.email ?? null;
    } catch {
      userId = null;
      userEmail = null;
    }

    let discountCouponId: string | null = null;

    if (promo_cents > 0 && promo_applied_code) {
      const coupon = await stripe.coupons.create({
        duration: "once",
        amount_off: promo_cents,
        currency: "cad",
        name: `Promo ${promo_applied_code}`,
      });
      discountCouponId = coupon.id;
    }

    const { data: createdOrder, error: oErr } = await supabase
      .from("orders")
      .insert({
        order_number,
        customer_email: customer_email,
        customer_name: customer_name,
        customer_phone: customer_phone,
        shipping_address: shipping_method === "pickup"
                          ? "2786 ON-34  Hawkesbury, ON K6A 2R2"
                          : shipping_address,
        promo_code: promo_applied_code,
        promo_discount: promo_cents / 100,
        shipping_cost: shipping_cents / 100,
        items: orderItems,
        subtotal: subtotal_cents / 100,
        tax: tax_cents / 100,
        total: total_cents / 100,

        payment_method: "stripe",
        payment_id: null,
        channel: "website",
        user_id: userId,
        stripe_session_id: null,
        amount_total_cents: total_cents,
        currency: "cad",
        status: "pending",
      })

      .select("order_id")
      .single();

    if (oErr) throw new Error(oErr.message);

    const orderId = createdOrder.order_id as string;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      discounts: discountCouponId ? [{ coupon: discountCouponId }] : undefined,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
      metadata: {
        cart: packed,
        order_id: orderId,
        order_number,
        user_id: userId ?? "",
        customer_name,
        customer_email,
        stripe_email: null,
        customer_phone,
        shipping_address,
        promo_code: promo_applied_code ?? "",
        promo_discount_cents: String(promo_cents),
        shipping_cost_cents: String(shipping_cents),
        shipping_method,
      },
    });

    if (!session.url) throw new Error("Stripe session missing url.");

    // Store session id for idempotency and linking
    const { error: updErr } = await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("order_id", orderId);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return new NextResponse(err?.message || "Checkout failed.", { status: 500 });
  }
}
