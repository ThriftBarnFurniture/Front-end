import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const RECEIPT_MAX_AGE = 30 * 24 * 60 * 60;

export function receiptCookieName(sessionId: string) {
  return `tb_receipt_${createHash("sha256").update(sessionId).digest("hex").slice(0, 24)}`;
}

export function createReceiptToken(sessionId: string, secret: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + RECEIPT_MAX_AGE;
  const signature = createHmac("sha256", secret).update(`receipt:v1:${sessionId}:${expires}`).digest("base64url");
  return `${expires}.${signature}`;
}

export function verifyReceiptToken(token: string | undefined, sessionId: string, secret: string, now = Date.now()) {
  if (!token || token.length > 128) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
  const expires = Number(parts[0]);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(now / 1000)) return false;
  const expected = createHmac("sha256", secret).update(`receipt:v1:${sessionId}:${expires}`).digest("base64url");
  const supplied = Buffer.from(parts[1]);
  const comparison = Buffer.from(expected);
  return supplied.length === comparison.length && timingSafeEqual(supplied, comparison);
}
