// app/api/services/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function serviceTitle(serviceId: string) {
  switch (serviceId) {
    case "moving":
      return "Moving";
    case "junk_removal":
      return "Junk Removal";
    case "furniture_assembly":
      return "Furniture Assembly";
    case "marketplace_pickup_delivery":
      return "Marketplace Pickup / Delivery";
    case "donation_pickup":
      return "Donation Pickup";
    default:
      return "Service Request";
  }
}

function isSafeKey(k: string) {
  // Basic filter to avoid sending unexpected/binary stuff as text
  if (k === "photos") return false;
  if (k === "website") return false; // honey pot
  return true;
}

function prettyKey(k: string) {
  return k
    .replace(/\[\]$/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formDataToObject(fd: FormData) {
  // Collect repeated keys into arrays
  const out: Record<string, string | string[]> = {};

  for (const [key, value] of fd.entries()) {
    if (!isSafeKey(key)) continue;

    if (value instanceof File) continue; // photos handled separately

    const str = value.toString().trim();
    if (!str) continue;

    const existing = out[key];
    if (existing === undefined) out[key] = str;
    else if (Array.isArray(existing)) existing.push(str);
    else out[key] = [existing, str];
  }

  return out;
}

function objectToPlainText(obj: Record<string, string | string[]>) {
  const lines: string[] = [];
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));

  for (const k of keys) {
    const v = obj[k];
    const label = prettyKey(k);
    const val = Array.isArray(v) ? v.join(", ") : v;
    lines.push(`${label}: ${val}`);
  }

  return lines.join("\n");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function objectToHtml(obj: Record<string, string | string[]>) {
  const rows: string[] = [];
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));

  for (const k of keys) {
    const v = obj[k];
    const label = escapeHtml(prettyKey(k));
    const val = escapeHtml(Array.isArray(v) ? v.join(", ") : v);
    rows.push(
      `<tr><td style="padding:10px;border:1px solid #e6e6e6;font-weight:700;vertical-align:top;">${label}</td><td style="padding:10px;border:1px solid #e6e6e6;vertical-align:top;">${val}</td></tr>`
    );
  }

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;">
      <table style="border-collapse:collapse;width:100%;max-width:760px;">
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function readPhotos(fd: FormData) {
  const files = fd.getAll("photos").filter((v) => v instanceof File) as File[];
  if (!files.length) return [];

  const trimmed = files.slice(0, MAX_PHOTOS);
  const attachments: { filename: string; content: Buffer; contentType?: string }[] =
    [];

  for (const f of trimmed) {
    if (f.size > MAX_PHOTO_BYTES) {
      // Skip overly large files rather than failing the whole request
      continue;
    }
    const arr = await f.arrayBuffer();
    attachments.push({
      filename: f.name || "photo.jpg",
      content: Buffer.from(arr),
      contentType: f.type || undefined,
    });
  }

  return attachments;
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData();

    // Honey pot anti-bot
    const honey = (fd.get("website") ?? "").toString().trim();
    if (honey) {
      return NextResponse.json({ ok: true, message: "Thanks! We’ll be in touch." });
    }

    const serviceId = (fd.get("service_id") ?? "").toString().trim();
    const contactName = (fd.get("contact_name") ?? "").toString().trim();
    const contactEmail = (fd.get("contact_email") ?? "").toString().trim();
    const contactPhone = (fd.get("contact_phone") ?? "").toString().trim();

    if (!serviceId) {
      return NextResponse.json(
        { ok: false, error: "Missing service_id." },
        { status: 400 }
      );
    }
    if (!contactName || !contactEmail || !contactPhone) {
      return NextResponse.json(
        { ok: false, error: "Name, email, and phone are required." },
        { status: 400 }
      );
    }

    const title = serviceTitle(serviceId);

    // Build details object
    const details = formDataToObject(fd);

    // Attach photos (optional)
    const attachments = await readPhotos(fd);

    // SMTP (Brevo)
    const SMTP_HOST = process.env.BREVO_SMTP_HOST ?? "smtp-relay.brevo.com";
    const SMTP_PORT = Number(process.env.BREVO_SMTP_PORT ?? "587");
    const SMTP_USER = requiredEnv("BREVO_SMTP_USER");
    const SMTP_PASS = requiredEnv("BREVO_SMTP_PASS");

    const FROM_EMAIL = requiredEnv("BREVO_FROM_EMAIL");
    const FROM_NAME = process.env.BREVO_FROM_NAME ?? "Thrift Barn Furniture";
    const OWNER_TO_EMAIL = requiredEnv("BREVO_OWNER_EMAIL");

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    // Email to you (owner)
    const ownerSubject = `[TBF Services] ${title} — ${contactName}`;
    const ownerText =
      `New service request: ${title}\n\n` +
      objectToPlainText(details) +
      `\n\nPhotos attached: ${attachments.length}`;

    const ownerHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;">
        <h2 style="margin:0 0 10px;">New service request: ${escapeHtml(title)}</h2>
        <p style="margin:0 0 16px;opacity:0.85;">From: <strong>${escapeHtml(
          contactName
        )}</strong> (${escapeHtml(contactEmail)} / ${escapeHtml(contactPhone)})</p>
        ${objectToHtml(details)}
        <p style="margin:16px 0 0;opacity:0.8;">Photos attached: ${
          attachments.length
        }</p>
      </div>
    `;

    await transporter.sendMail({
      from: { name: FROM_NAME, address: FROM_EMAIL },
      to: OWNER_TO_EMAIL,
      replyTo: contactEmail,
      subject: ownerSubject,
      text: ownerText,
      html: ownerHtml,
      attachments,
    });

    // Confirmation email to client
    const clientSubject = `We received your request — ${title}`;
    const clientText =
      `Hi ${contactName},\n\n` +
      `Thanks for the details! A member of the Barn will reach out soon for booking.\n\n` +
      `Here’s what we received:\n\n` +
      objectToPlainText(details) +
      `\n\n— Thrift Barn Furniture`;

    const clientHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;">
        <h2 style="margin:0 0 10px;">We received your request</h2>
        <p style="margin:0 0 14px;">Hi <strong>${escapeHtml(
          contactName
        )}</strong>,</p>
        <p style="margin:0 0 18px;opacity:0.9;">
          Thanks for the details! A member of the Barn will reach out soon for booking.
        </p>
        <p style="margin:0 0 10px;font-weight:700;">Service: ${escapeHtml(
          title
        )}</p>
        ${objectToHtml(details)}
        <p style="margin:18px 0 0;opacity:0.85;">— Thrift Barn Furniture</p>
      </div>
    `;

    await transporter.sendMail({
      from: { name: FROM_NAME, address: FROM_EMAIL },
      to: contactEmail,
      subject: clientSubject,
      text: clientText,
      html: clientHtml,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Thanks for the details — a member of the Barn will reach out soon for booking!",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
