/*
Upload helper for Cloudflare R2 (S3-compatible):

Creates S3 client pointed at R2

Uploads a File using PutObjectCommand

Returns { key, publicUrl } using NEXT_PUBLIC_R2_PUBLIC_URL
*/

import { createHash, createHmac } from "crypto";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function extFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || "thrift-barn-images";
  const publicBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 configuration. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY."
    );
  }

  if (!publicBase) {
    throw new Error("Missing NEXT_PUBLIC_R2_PUBLIC_URL");
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicBase };
}

function buildR2SigningKey(secretAccessKey: string, dateStamp: string) {
  const hmac = (key: Buffer | string, value: string) =>
    createHmac("sha256", key).update(value, "utf8").digest();

  return hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), "auto"), "s3"), "aws4_request");
}

function getR2Host(accountId: string) {
  return `${accountId}.r2.cloudflarestorage.com`;
}

function getAmzDateParts(now: Date) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function getR2KeyFromPublicUrl(imageUrl: string, publicBase: string) {
  try {
    const base = new URL(publicBase);
    const target = new URL(imageUrl);

    if (base.origin !== target.origin) return null;
    if (!target.pathname.startsWith(base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`)) {
      return null;
    }

    const relative = target.pathname.slice(base.pathname.length).replace(/^\/+/, "");
    return relative ? decodeURIComponent(relative) : null;
  } catch {
    return null;
  }
}

export async function uploadProductImageToR2(file: File) {
  const { accountId, accessKeyId, secretAccessKey, bucket, publicBase } = getR2Config();
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, WEBP images are allowed.");
  }
  if (file.size <= 0) throw new Error("Empty file.");
  if (file.size > MAX_BYTES) throw new Error("Image too large (max 10MB).");

  const key = `products/${crypto.randomUUID()}.${extFromMime(file.type)}`;
  const body = Buffer.from(await file.arrayBuffer());
  const host = getR2Host(accountId);
  const url = `https://${host}/${bucket}/${encodeURI(key)}`;
  const now = new Date();
  const { amzDate, dateStamp } = getAmzDateParts(now);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const canonicalHeaders = [
    `content-type:${file.type}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    `/${bucket}/${encodeURI(key)}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const canonicalRequestHash = createHash("sha256").update(canonicalRequest).digest("hex");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, canonicalRequestHash].join(
    "\n"
  );
  const signingKey = buildR2SigningKey(secretAccessKey, dateStamp);

  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${errorText}`);
  }

  return { key, publicUrl: `${publicBase}/${key}` };
}

export async function deleteProductImagesFromR2(imageUrls: Array<string | null | undefined>) {
  const { accountId, accessKeyId, secretAccessKey, bucket, publicBase } = getR2Config();
  const keys = Array.from(
    new Set(
      imageUrls
        .map((url) => (url ? getR2KeyFromPublicUrl(url, publicBase) : null))
        .filter((key): key is string => Boolean(key))
    )
  );

  if (!keys.length) return { deletedKeys: [] as string[] };

  const host = getR2Host(accountId);
  const deletedKeys: string[] = [];

  for (const key of keys) {
    const now = new Date();
    const { amzDate, dateStamp } = getAmzDateParts(now);
    const payloadHash = createHash("sha256").update("").digest("hex");
    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      "",
    ].join("\n");
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      "DELETE",
      `/${bucket}/${encodeURI(key)}`,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const canonicalRequestHash = createHash("sha256").update(canonicalRequest).digest("hex");
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, canonicalRequestHash].join(
      "\n"
    );
    const signingKey = buildR2SigningKey(secretAccessKey, dateStamp);
    const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const url = `https://${host}/${bucket}/${encodeURI(key)}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: authorization,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`R2 delete failed for ${key}: ${errorText || response.status}`);
    }

    deletedKeys.push(key);
  }

  return { deletedKeys };
}
