import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

const stripe = getStripe();

import { createSupabaseAdmin } from "@/lib/supabase-admin";
// OPTIONAL (recommended): attach logged-in user_id to orders
import { createClient } from "@/utils/supabase/server";

type Body = {
  items: { productId: string; quantity: number }[];
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;

  shipping_method?: "pickup" | "delivery_drop" | "inhouse_drop" | "quote";
  shipping_address?: string; // required for delivery_drop/inhouse_drop/quote

  promo_code?: string;
  promo_discount?: number; // ignored (server computes)
};

type PromoRow = {
  code: string;
  percent_off: number | null;
  amount_off: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

const STORE_ADDRESS = "2786 ON-34  Hawkesbury, ON K6A 2R2";

const OVERSIZED_FEE_CAD = 135;

const TIER_1_MAX_KM = 49;
const TIER_2_MAX_KM = 200;

const PRICES = {
  tier1: { delivery_drop: 17.5, inhouse_drop: 45 },
  tier2: { delivery_drop: 55, inhouse_drop: 115 },
} as const;

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

function computeBaseShippingFromKm(method: "delivery_drop" | "inhouse_drop", km: number) {
  if (km <= TIER_1_MAX_KM) {
    return method === "delivery_drop" ? PRICES.tier1.delivery_drop : PRICES.tier1.inhouse_drop;
  }
  if (km <= TIER_2_MAX_KM) {
    return method === "delivery_drop" ? PRICES.tier2.delivery_drop : PRICES.tier2.inhouse_drop;
  }
  return 0;
}

async function getDistanceKm(origin: string, destination: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_PLACES_API_KEY");

  const url =
    "https://maps.googleapis.com/maps/api/distancematrix/json" +
    `?origins=${encodeURIComponent(origin)}` +
    `&destinations=${encodeURIComponent(destination)}` +
    `&units=metric` +
    `&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to contact Google Distance Matrix API.");

  const data = await res.json();
  const element = data?.rows?.[0]?.elements?.[0];

  if (!element || element.status !== "OK") {
    throw new Error("Unable to calculate distance for this address.");
  }

  const meters = Number(element.distance?.value);
  if (!Number.isFinite(meters) || meters <= 0) {
    throw new Error("Invalid distance returned.");
  }

  return meters / 1000;
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

    const shipping_method = (body?.shipping_method ?? "") as Body["shipping_method"] | "";
    const shipping_address = String(body?.shipping_address ?? "").trim();

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
        promo_applied_code = promo.code;
        // we'll compute promo_cents after we know subtotal + shipping
      }
    }

    if (!customer_name || !customer_email || !customer_phone) {
      return NextResponse.json({ error: "Missing checkout info." }, { status: 400 });
    }

    if (shipping_method !== "pickup" && shipping_method !== "delivery_drop" && shipping_method !== "inhouse_drop" && shipping_method !== "quote") {
      return NextResponse.json({ error: "Missing shipping method." }, { status: 400 });
    }

    const needsAddress =
      shipping_method === "delivery_drop" || shipping_method === "inhouse_drop" || shipping_method === "quote";

    if (needsAddress && !shipping_address) {
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
    // ✅ include is_oversized so we can apply $135 fee if any item is oversized
    const { data: products, error } = await supabase
      .from("products")
      .select("id,name,price,quantity,is_active,image_url,is_oversized")
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

      if (typeof p.quantity === "number" && p.quantity <= 0) {
        return new NextResponse(
          "An item in your cart is out of stock, please remove to continue with purchase.",
          { status: 400 }
        );
      }

      if (typeof p.quantity === "number" && p.quantity < w.quantity) {
        return new NextResponse(`Not enough stock for: ${p.name}`, { status: 400 });
      }
    }

    const hasOversizedItem = wanted.some((w) => Boolean(map.get(w.productId)?.is_oversized));

    // ✅ SERVER-CALCULATED SHIPPING (ignore any client shipping_cost)
    let distance_km: number | null = null;
    let base_shipping_cad = 0;

    if (shipping_method === "pickup") {
      base_shipping_cad = 0;
    } else {
      // quote is blocked
      distance_km = await getDistanceKm(STORE_ADDRESS, shipping_address);

      if (distance_km > TIER_2_MAX_KM || shipping_method === "quote") {
        return NextResponse.json(
          { error: "This address is 200km+ away. Please email for a case-specific quote." },
          { status: 400 }
        );
      }

      if (shipping_method !== "delivery_drop" && shipping_method !== "inhouse_drop") {
        return NextResponse.json({ error: "Invalid shipping method." }, { status: 400 });
      }

      base_shipping_cad = computeBaseShippingFromKm(shipping_method, distance_km);
    }

    const oversized_fee_cad =shipping_method === "inhouse_drop" && hasOversizedItem ? OVERSIZED_FEE_CAD : 0;
    const shipping_cost_cad = Math.max(0, base_shipping_cad + oversized_fee_cad);

    // Build Stripe line items from Supabase prices (secure)
    const line_items: any[] = wanted.map((w) => {
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
        is_oversized: Boolean((p as any).is_oversized),
      };
    });

    const subtotal_cents = orderItems.reduce((sum, it) => sum + it.unit_price_cents * it.quantity, 0);

    const shipping_cents = Math.max(0, Math.round(shipping_cost_cad * 100));
    const taxable_base_cents = subtotal_cents + shipping_cents;

    // ✅ compute promo_cents using promo row rules (percent_off OR amount_off)
    if (promo_applied_code) {
      const nowIso = new Date().toISOString();

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
        promo_applied_code = null;
        promo_cents = 0;
      }
    }

    promo_cents = clamp(promo_cents, 0, taxable_base_cents);
    const tax_cents = 0;
    const total_cents = taxable_base_cents - promo_cents + tax_cents;

    // ✅ Add shipping as its own Stripe line item so it gets charged
    if (shipping_cents > 0) {
      const shippingName =
        shipping_method === "delivery_drop"
          ? "Shipping — Delivery Drop"
          : shipping_method === "inhouse_drop"
          ? "Shipping — Inhouse Drop"
          : "Shipping";

      const descParts: string[] = [];
      if (distance_km != null) descParts.push(`Distance: ${distance_km.toFixed(1)} km`);
      if (oversized_fee_cad > 0) descParts.push(`Oversized item fee included`);

      line_items.push({
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: shipping_cents,
          product_data: {
            name: shippingName,
            description: descParts.length ? descParts.join(" • ") : undefined,
            images: undefined,
          },
        },
      });
    }

    // OPTIONAL: attach logged-in user_id so it shows in /account/orders
    let userId: string | null = null;
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

    // Create pending order FIRST (so webhook updates it)
    const order_number = makeOrderNumber();

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

        shipping_address: shipping_method === "pickup" ? STORE_ADDRESS : shipping_address,
        shipping_method: shipping_method,

        promo_code: promo_applied_code,
        promo_discount: promo_cents / 100,

        shipping_cost: shipping_cents / 100,

        // extra helpful breakdowns (optional; only if these columns exist)
        // If your orders table doesn't have these columns, REMOVE these fields.
        // distance_km: distance_km,
        // overweight_fee: overweight_fee_cad,

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

        shipping_method,
        shipping_address: shipping_method === "pickup" ? STORE_ADDRESS : shipping_address,

        shipping_cost_cents: String(shipping_cents),
        shipping_base_cents: String(Math.round(base_shipping_cad * 100)),
        oversized_fee_cents: String(Math.round(oversized_fee_cad * 100)),
        distance_km: distance_km != null ? String(distance_km) : "",

        promo_code: promo_applied_code ?? "",
        promo_discount_cents: String(promo_cents),
      },
    });

    if (!session.url) throw new Error("Stripe session missing url.");

    // Store session id for idempotency and linking
    const { error: updErr } = await supabase.from("orders").update({ stripe_session_id: session.id }).eq("order_id", orderId);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return new NextResponse(err?.message || "Checkout failed.", { status: 500 });
  }
}
