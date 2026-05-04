import nodemailer from "nodemailer";

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

type BrevoMessage = {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  replyTo?: { email: string; name?: string };
};

const STORE_SUPPORT_EMAIL =
  process.env.ORDER_SUPPORT_EMAIL ||
  process.env.BREVO_OWNER_EMAIL ||
  process.env.BREVO_FROM_EMAIL ||
  "noreply@thriftbarnfurniture.ca";
const STORE_SUPPORT_NAME = process.env.BREVO_FROM_NAME || "Thrift Barn Furniture";
const STORE_ADDRESS = "2786 ON-34, Hawkesbury, ON K6A 2R2";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

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

function buildItemsText(payload: OrderEmailPayload) {
  const items = payload.items ?? [];
  if (!items.length) return "No item details available.";

  return items
    .map((item) => {
      const name = text(item.name);
      const productId = text(item.productId);
      const qty = Math.max(1, Math.floor(Number(item.qty ?? 1)));
      const unit = money(item.unitPrice ?? null, payload.currency);
      const lineTotal = money(item.lineTotal ?? (item.unitPrice ?? 0) * qty, payload.currency);
      return `- ${name} | Product ID: ${productId} | Qty: ${qty} | Unit: ${unit} | Line Total: ${lineTotal}`;
    })
    .join("\n");
}

function buildEmailShell(title: string, intro: string, sectionsHtml: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:760px;margin:0 auto">
      <h2 style="margin:0 0 12px">${esc(title)}</h2>
      <p style="margin:0 0 18px">${intro}</p>
      ${sectionsHtml}
    </div>
  `;
}

function buildAdminOrderEmail(payload: OrderEmailPayload) {
  const orderLabel = text(payload.orderNumber || payload.orderId);
  const subject = `New order ${orderLabel} - ${money(payload.total ?? null, payload.currency ?? "CAD")}`;
  const itemsHtml = buildItemsHtml(payload);

  const htmlContent = buildEmailShell(
    "New order received",
    "A new website order has been placed.",
    `
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
    `
  );

  return { subject, htmlContent };
}

function buildCustomerOrderEmail(payload: OrderEmailPayload) {
  const orderLabel = text(payload.orderNumber || payload.orderId);
  const subject = `Order confirmation ${orderLabel} - ${STORE_SUPPORT_NAME}`;
  const itemsHtml = buildItemsHtml(payload);
  const helpEmail = esc(STORE_SUPPORT_EMAIL);
  const helpName = esc(STORE_SUPPORT_NAME);

  const htmlContent = buildEmailShell(
    `Thanks for your order, ${esc(text(payload.customerName))}`,
    `We’ve received your order and your payment has been processed. Keep this email for your records.`,
    `
      <h3 style="margin:16px 0 6px">Order summary</h3>
      <p style="margin:0 0 10px">
        <b>Order number:</b> ${esc(text(payload.orderNumber))}<br/>
        <b>Order ID:</b> ${esc(text(payload.orderId))}<br/>
        <b>Purchase date:</b> ${esc(formatDateTime(payload.purchaseDate))}<br/>
        <b>Payment status:</b> ${esc(text(payload.status))}<br/>
        <b>Shipping method:</b> ${esc(text(payload.shippingMethod))}<br/>
        <b>Shipping address:</b> ${esc(text(payload.shippingAddress))}
      </p>

      <h3 style="margin:16px 0 6px">Your details</h3>
      <p style="margin:0 0 10px">
        <b>Name:</b> ${esc(text(payload.customerName))}<br/>
        <b>Email:</b> ${esc(text(payload.customerEmail))}<br/>
        <b>Phone:</b> ${esc(text(payload.customerPhone))}
      </p>

      <h3 style="margin:16px 0 6px">Items ordered</h3>
      ${itemsHtml}

      <h3 style="margin:16px 0 6px">Cost breakdown</h3>
      <p style="margin:0 0 10px">
        <b>Subtotal:</b> ${esc(money(payload.subtotal ?? null, payload.currency))}<br/>
        <b>Shipping:</b> ${esc(money(payload.shippingCost ?? null, payload.currency))}<br/>
        <b>Promo discount:</b> ${esc(money(payload.promoDiscount ?? null, payload.currency))}<br/>
        <b>Tax:</b> ${esc(money(payload.tax ?? null, payload.currency))}<br/>
        <b>Total charged:</b> ${esc(money(payload.total ?? null, payload.currency))}
      </p>

      <h3 style="margin:16px 0 6px">Need help?</h3>
      <p style="margin:0 0 10px">
        Contact ${helpName} at <a href="mailto:${helpEmail}">${helpEmail}</a>
        Store address: ${esc(STORE_ADDRESS)}
      </p>
    `
  );

  const textContent = [
    `Thanks for your order, ${text(payload.customerName)}.`,
    "",
    `Order number: ${text(payload.orderNumber)}`,
    `Order ID: ${text(payload.orderId)}`,
    `Purchase date: ${formatDateTime(payload.purchaseDate)}`,
    `Payment status: ${text(payload.status)}`,
    `Shipping method: ${text(payload.shippingMethod)}`,
    `Shipping address: ${text(payload.shippingAddress)}`,
    "",
    "Your details",
    `Name: ${text(payload.customerName)}`,
    `Email: ${text(payload.customerEmail)}`,
    `Phone: ${text(payload.customerPhone)}`,
    "",
    "Items ordered",
    buildItemsText(payload),
    "",
    "Cost breakdown",
    `Subtotal: ${money(payload.subtotal ?? null, payload.currency)}`,
    `Shipping: ${money(payload.shippingCost ?? null, payload.currency)}`,
    `Promo discount: ${money(payload.promoDiscount ?? null, payload.currency)}`,
    `Tax: ${money(payload.tax ?? null, payload.currency)}`,
    `Total charged: ${money(payload.total ?? null, payload.currency)}`,
    "",
    "Need help?",
    `Email: ${STORE_SUPPORT_EMAIL}`,
    `Address: ${STORE_ADDRESS}`,
  ].join("\n");

  return { subject, htmlContent, textContent };
}

async function sendBrevoEmail(message: BrevoMessage & { textContent?: string }) {
  const smtpHost = process.env.BREVO_SMTP_HOST ?? "smtp-relay.brevo.com";
  const smtpPort = Number(process.env.BREVO_SMTP_PORT ?? "587");
  const smtpUser = requiredEnv("BREVO_SMTP_USER");
  const smtpPass = requiredEnv("BREVO_SMTP_PASS");
  const fromEmail = requiredEnv("BREVO_FROM_EMAIL");
  const fromName = process.env.BREVO_FROM_NAME || "Thrift Barn Furniture";

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: { name: fromName, address: fromEmail },
    to: message.to.map((entry) => ({ name: entry.name, address: entry.email })),
    replyTo: message.replyTo ? { name: message.replyTo.name, address: message.replyTo.email } : undefined,
    subject: message.subject,
    text: message.textContent,
    html: message.htmlContent,
  });
}

export async function sendAdminOrderEmail(payload: OrderEmailPayload) {
  const toEmail = process.env.BREVO_OWNER_EMAIL;
  if (!toEmail) throw new Error("Missing BREVO_OWNER_EMAIL");
  const message = buildAdminOrderEmail(payload);

  await sendBrevoEmail({
    to: [{ email: toEmail }],
    subject: message.subject,
    htmlContent: message.htmlContent,
    replyTo: payload.customerEmail
      ? { email: payload.customerEmail, name: payload.customerName ?? undefined }
      : undefined,
  });
}

export async function sendCustomerOrderEmail(payload: OrderEmailPayload) {
  const customerEmail = String(payload.customerEmail ?? "").trim();
  if (!customerEmail) throw new Error("Missing customer email for confirmation email.");

  const message = buildCustomerOrderEmail(payload);

  await sendBrevoEmail({
    to: [{ email: customerEmail, name: payload.customerName ?? undefined }],
    subject: message.subject,
    htmlContent: message.htmlContent,
    textContent: message.textContent,
    replyTo: { email: STORE_SUPPORT_EMAIL, name: STORE_SUPPORT_NAME },
  });
}
