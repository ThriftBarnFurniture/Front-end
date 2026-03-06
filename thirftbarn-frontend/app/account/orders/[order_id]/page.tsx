// app/account/orders/[order_id]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import accountStyles from "../../account.module.css";
import styles from "./order-details.module.css";

type OrderRow = {
  order_id: string;
  order_number: string | null;
  status: string | null;
  currency: string | null;

  subtotal: number | null;
  tax: number | null;
  total: number | null;

  purchase_date: string | null;

  items: any; // text[]
  shipping_address: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  shipping_cost: number | null;
  promo_code: string | null;
  promo_discount: number | null;

  shipping_method: string | null;
  overweight_fee: number | null;
};

type Item = {
  product_id?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  unit_price_cents?: number;
  unitPriceCents?: number;
};

type ProductMini = {
  id: string;
  name: string | null;
  image_url: string | null;
  price: number | null;
};

function money(n: number, currency: string) {
  return `${n.toFixed(2)} ${currency}`;
}

function titleCase(s: string) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function parseItems(raw: any): Item[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      if (!x) return null;
      if (typeof x === "object") return x as Item;
      if (typeof x === "string") {
        try {
          return JSON.parse(x) as Item;
        } catch {
          return null;
        }
      }
      return null;
    })
    .filter(Boolean) as Item[];
}

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ order_id: string }>;
}) {
  const { order_id } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <div className={accountStyles.page}>
        <div className={accountStyles.container}>
          <p>
            Please <Link href="/login">log in</Link> to view this order.
          </p>
        </div>
      </div>
    );
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "order_id,order_number,status,currency,subtotal,tax,total,purchase_date,items,shipping_address,customer_name,customer_email,customer_phone,shipping_cost,promo_code,promo_discount,shipping_method,overweight_fee"
    )
    .eq("order_id", order_id)
    .eq("user_id", auth.user.id)
    .single();

  if (error || !order) return notFound();

  const currency = String(order.currency ?? "cad").toUpperCase();

  const items = parseItems(order.items);

  const productIds = Array.from(
    new Set(
      items
        .map((it) => String(it.product_id ?? it.productId ?? ""))
        .filter(Boolean)
    )
  );

  let prodMap: Record<string, ProductMini> = {};
  if (productIds.length) {
    const { data: products } = await supabase
      .from("products")
      .select("id,name,image_url,price")
      .in("id", productIds);

    for (const p of (products ?? []) as ProductMini[]) {
      prodMap[p.id] = p;
    }
  }

  const shipping = Number(order.shipping_cost ?? 0);
  const promo = Number(order.promo_discount ?? 0);
  const overweight = Number(order.overweight_fee ?? 0);

  return (
    <div className={accountStyles.page}>
      <div className={accountStyles.container}>
        <div className={styles.topBar}>
          <div>
            <div className={styles.kicker}>Order</div>
            <h1 className={styles.title}>
              {order.order_number ?? order.order_id}
            </h1>
            <div className={styles.meta}>
              <span className={styles.badge}>
                {String(order.status ?? "unknown").toUpperCase()}
              </span>
              <span className={styles.dot}>•</span>
              <span className={styles.muted}>
                {order.purchase_date
                  ? new Date(order.purchase_date).toLocaleString()
                  : "Pending payment"}
              </span>
            </div>
          </div>

          <Link className={styles.backLink} href="/account/orders">
            ← Back to orders
          </Link>
        </div>

        <div className={styles.grid}>
          {/* LEFT: items */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Items</div>

            {items.length === 0 ? (
              <div className={styles.empty}>No items found for this order.</div>
            ) : (
              <div className={styles.itemList}>
                {items.map((it, idx) => {
                  const pid = String(it.product_id ?? it.productId ?? "");
                  const p = pid ? prodMap[pid] : undefined;

                  const qty = Math.max(1, Number(it.quantity ?? it.qty ?? 1));

                  const unitCents =
                    typeof it.unit_price_cents === "number"
                      ? it.unit_price_cents
                      : typeof it.unitPriceCents === "number"
                      ? it.unitPriceCents
                      : typeof p?.price === "number"
                      ? Math.round(p.price * 100)
                      : null;

                  const name = it.name ?? p?.name ?? "Item";
                  const unit =
                    typeof unitCents === "number"
                      ? (unitCents / 100).toFixed(2)
                      : null;

                  const lineTotal =
                    typeof unitCents === "number"
                      ? ((unitCents * qty) / 100).toFixed(2)
                      : null;

                  return (
                    <div key={idx} className={styles.itemRow}>
                      <div className={styles.itemLeft}>
                        <div className={styles.thumb}>
                          {p?.image_url ? (
                            <Image
                              src={p.image_url}
                              alt={String(name)}
                              fill
                              className={styles.thumbImg}
                              sizes="64px"
                            />
                          ) : (
                            <div className={styles.thumbFallback} />
                          )}
                        </div>

                        <div className={styles.itemText}>
                          <div className={styles.itemName}>{name}</div>
                          <div className={styles.itemSub}>
                            Qty: {qty}
                            {unit ? (
                              <>
                                <span className={styles.dot}>•</span>
                                Unit: {unit} {currency}
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className={styles.itemPrice}>
                        {lineTotal ? (
                          <>
                            {lineTotal} {currency}
                          </>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: summary + customer */}
          <div className={styles.stack}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Summary</div>

              <div className={styles.row}>
                <span>Subtotal</span>
                <strong>{money(Number(order.subtotal ?? 0), currency)}</strong>
              </div>

              <div className={styles.row}>
                <span>Promo {order.promo_code ? `(${order.promo_code})` : ""}</span>
                <strong>
                  {promo > 0 ? `-${money(promo, currency)}` : money(0, currency)}
                </strong>
              </div>

              <div className={styles.row}>
                <span>Shipping</span>
                <strong>{money(shipping, currency)}</strong>
              </div>

              <div className={styles.row}>
                <span>Overweight fee</span>
                <strong>{money(overweight, currency)}</strong>
              </div>

              <div className={styles.row}>
                <span>Tax</span>
                <strong>{money(Number(order.tax ?? 0), currency)}</strong>
              </div>

              <div className={styles.totalRow}>
                <span>Total</span>
                <strong>{money(Number(order.total ?? 0), currency)}</strong>
              </div>

              <div className={styles.smallMeta}>
                <div>
                  <span className={styles.muted}>Shipping method: </span>
                  <span>{order.shipping_method ? titleCase(order.shipping_method) : "—"}</span>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Customer</div>

              <div className={styles.row}>
                <span>Name</span>
                <strong>{order.customer_name ?? "—"}</strong>
              </div>
              <div className={styles.row}>
                <span>Email</span>
                <strong>{order.customer_email ?? "—"}</strong>
              </div>
              <div className={styles.row}>
                <span>Phone</span>
                <strong>{order.customer_phone ?? "—"}</strong>
              </div>
              <div className={styles.rowTop}>
                <span>Address</span>
                <strong className={styles.addr}>{order.shipping_address ?? "—"}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footerSpace} />
      </div>
    </div>
  );
}
