import SibApiV3Sdk from "sib-api-v3-sdk";

type OrderItem = {
  name?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
};

type OrderEmailPayload = {
  orderNumber?: string | null;
  total?: number | null;
  currency?: string | null;

  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;

  items?: OrderItem[];
  stripeSessionId?: string | null;
};

function money(n: number | null | undefined, currency: string | null | undefined) {
  if (n == null) return "—";
  const c = (currency || "CAD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: c }).format(n);
  } catch {
    return `${n} ${c}`;
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendAdminOrderEmail(payload: OrderEmailPayload) {
  const apiKey = process.env.BREVO_API_KEY;
  const toEmail = process.env.SERVICES_OWNER_EMAIL;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "Thrift Barn Furniture";

  if (!apiKey) throw new Error("Missing BREVO_API_KEY");
  if (!toEmail) throw new Error("Missing SERVICES_OWNER_EMAIL");
  if (!fromEmail) throw new Error("Missing BREVO_FROM_EMAIL");

  // Configure Brevo client
  const client = SibApiV3Sdk.ApiClient.instance;
  client.authentications["api-key"].apiKey = apiKey;

  const api = new SibApiV3Sdk.TransactionalEmailsApi();

  const subject = `New order${payload.orderNumber ? ` #${payload.orderNumber}` : ""} — ${money(
    payload.total ?? null,
    payload.currency ?? "CAD"
  )}`;

  const itemsHtml =
    payload.items && payload.items.length
      ? `<ul>
          ${payload.items
            .map((it) => {
              const name = escapeHtml(it.name || "Item");
              const qty = it.qty ?? 1;
              const unit = it.unitPrice ?? null;
              return `<li><b>${name}</b> — qty: ${qty}${unit != null ? ` — unit: ${money(unit, payload.currency)}` : ""}</li>`;
            })
            .join("")}
        </ul>`
      : `<p><i>No item details available in payload.</i></p>`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.4">
      <h2 style="margin:0 0 8px">New order received</h2>
      <p style="margin:0 0 12px">
        <b>Order:</b> ${escapeHtml(payload.orderNumber || "—")}<br/>
        <b>Total:</b> ${escapeHtml(money(payload.total ?? null, payload.currency ?? "CAD"))}<br/>
        <b>Stripe session:</b> ${escapeHtml(payload.stripeSessionId || "—")}
      </p>

      <h3 style="margin:18px 0 6px">Customer</h3>
      <p style="margin:0 0 12px">
        <b>Name:</b> ${escapeHtml(payload.customerName || "—")}<br/>
        <b>Email:</b> ${escapeHtml(payload.customerEmail || "—")}<br/>
        <b>Phone:</b> ${escapeHtml(payload.customerPhone || "—")}
      </p>

      <h3 style="margin:18px 0 6px">Shipping</h3>
      <p style="margin:0 0 12px">${escapeHtml(payload.shippingAddress || "—")}</p>

      <h3 style="margin:18px 0 6px">Items</h3>
      ${itemsHtml}
    </div>
  `;

  await api.sendTransacEmail({
    sender: { email: fromEmail, name: fromName },
    to: [{ email: toEmail }],
    subject,
    htmlContent: html,
  });
}
