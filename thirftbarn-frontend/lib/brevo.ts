export type OrderEmailItem = {
  productId?: string | null;
  name?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
};

export type OrderEmailPayload = {
  orderId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
  purchaseDate?: string | null;

  subtotal?: number | null;
  shippingCost?: number | null;
  promoCode?: string | null;
  promoDiscount?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;

  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shippingMethod?: string | null;
  shippingAddress?: string | null;

  paymentId?: string | null;
  stripeSessionId?: string | null;

  items?: OrderEmailItem[];
};

function money(n: number | null | undefined, currency: string | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "--";
  const c = (currency || "CAD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: c }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c}`;
  }
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function text(v: string | null | undefined) {
  const clean = String(v ?? "").trim();
  return clean || "--";
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return text(iso);
  return d.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildItemsHtml(payload: OrderEmailPayload) {
  const items = payload.items ?? [];
  if (!items.length) return "<p><i>No item details available.</i></p>";

  const rows = items
    .map((item) => {
      const name = esc(text(item.name));
      const productId = esc(text(item.productId));
      const qty = Math.max(1, Math.floor(Number(item.qty ?? 1)));
      const unit = money(item.unitPrice ?? null, payload.currency);
      const lineTotal = money(item.lineTotal ?? (item.unitPrice ?? 0) * qty, payload.currency);

      return `
        <tr>
          <td style="padding:8px;border:1px solid #ddd">${name}</td>
          <td style="padding:8px;border:1px solid #ddd">${productId}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${qty}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${esc(unit)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${esc(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead>
        <tr>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Item</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Product ID</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:right">Qty</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:right">Unit</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:right">Line Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export async function sendAdminOrderEmail(payload: OrderEmailPayload) {
  const apiKey = process.env.BREVO_API_KEY;
  const toEmail = process.env.BREVO_OWNER_EMAIL;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "Thrift Barn Furniture";

  if (!apiKey) throw new Error("Missing BREVO_API_KEY");
  if (!toEmail) throw new Error("Missing BREVO_OWNER_EMAIL");
  if (!fromEmail) throw new Error("Missing BREVO_FROM_EMAIL");

  const orderLabel = text(payload.orderNumber || payload.orderId);
  const subject = `New order ${orderLabel} - ${money(payload.total ?? null, payload.currency ?? "CAD")}`;

  const itemsHtml = buildItemsHtml(payload);

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.4;color:#111">
      <h2 style="margin:0 0 10px">New order received</h2>

      <h3 style="margin:16px 0 6px">Order</h3>
      <p style="margin:0 0 10px">
        <b>Order number:</b> ${esc(text(payload.orderNumber))}<br/>
        <b>Order ID:</b> ${esc(text(payload.orderId))}<br/>
        <b>Status:</b> ${esc(text(payload.status))}<br/>
        <b>Purchase date:</b> ${esc(formatDateTime(payload.purchaseDate))}<br/>
        <b>Stripe session:</b> ${esc(text(payload.stripeSessionId))}<br/>
        <b>Payment ID:</b> ${esc(text(payload.paymentId))}
      </p>

      <h3 style="margin:16px 0 6px">Customer</h3>
      <p style="margin:0 0 10px">
        <b>Name:</b> ${esc(text(payload.customerName))}<br/>
        <b>Email:</b> ${esc(text(payload.customerEmail))}<br/>
        <b>Phone:</b> ${esc(text(payload.customerPhone))}<br/>
        <b>Shipping method:</b> ${esc(text(payload.shippingMethod))}<br/>
        <b>Shipping address:</b> ${esc(text(payload.shippingAddress))}
      </p>

      <h3 style="margin:16px 0 6px">Totals</h3>
      <p style="margin:0 0 10px">
        <b>Subtotal:</b> ${esc(money(payload.subtotal ?? null, payload.currency))}<br/>
        <b>Shipping:</b> ${esc(money(payload.shippingCost ?? null, payload.currency))}<br/>
        <b>Promo:</b> ${esc(text(payload.promoCode))} (${esc(money(payload.promoDiscount ?? null, payload.currency))})<br/>
        <b>Tax:</b> ${esc(money(payload.tax ?? null, payload.currency))}<br/>
        <b>Total:</b> ${esc(money(payload.total ?? null, payload.currency))}
      </p>

      <h3 style="margin:16px 0 6px">Items</h3>
      ${itemsHtml}
    </div>
  `;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: toEmail }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const textBody = await res.text().catch(() => "");
    throw new Error(`Brevo send failed: ${res.status} ${res.statusText} ${textBody}`);
  }
}
