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

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendAdminOrderEmail(payload: OrderEmailPayload) {
  const apiKey = process.env.BREVO_API_KEY;
  const toEmail = process.env.BREVO_OWNER_EMAIL;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "Thrift Barn Furniture";

  if (!apiKey) throw new Error("Missing BREVO_API_KEY");
  if (!toEmail) throw new Error("Missing BREVO_OWNER_EMAIL");
  if (!fromEmail) throw new Error("Missing BREVO_FROM_EMAIL");

  const subject = `New order${payload.orderNumber ? ` #${payload.orderNumber}` : ""} — ${money(
    payload.total ?? null,
    payload.currency ?? "CAD"
  )}`;

  const itemsHtml =
    payload.items && payload.items.length
      ? `<ul>${payload.items
          .map((it) => {
            const name = esc(it.name || "Item");
            const qty = it.qty ?? 1;
            const unit = it.unitPrice ?? null;
            return `<li><b>${name}</b> — qty: ${qty}${unit != null ? ` — unit: ${esc(money(unit, payload.currency))}` : ""}</li>`;
          })
          .join("")}</ul>`
      : `<p><i>No item details available.</i></p>`;

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.4">
      <h2 style="margin:0 0 8px">New order received</h2>
      <p style="margin:0 0 12px">
        <b>Order:</b> ${esc(payload.orderNumber || "—")}<br/>
        <b>Total:</b> ${esc(money(payload.total ?? null, payload.currency ?? "CAD"))}<br/>
        <b>Stripe session:</b> ${esc(payload.stripeSessionId || "—")}
      </p>

      <h3 style="margin:18px 0 6px">Customer</h3>
      <p style="margin:0 0 12px">
        <b>Name:</b> ${esc(payload.customerName || "—")}<br/>
        <b>Email:</b> ${esc(payload.customerEmail || "—")}<br/>
        <b>Phone:</b> ${esc(payload.customerPhone || "—")}
      </p>

      <h3 style="margin:18px 0 6px">Shipping</h3>
      <p style="margin:0 0 12px">${esc(payload.shippingAddress || "—")}</p>

      <h3 style="margin:18px 0 6px">Items</h3>
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
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo send failed: ${res.status} ${res.statusText} ${text}`);
  }
}
