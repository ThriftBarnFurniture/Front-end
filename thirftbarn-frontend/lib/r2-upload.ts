/*
Upload helper for Cloudflare R2 (S3-compatible):

Creates S3 client pointed at R2

Uploads a File using PutObjectCommand

Returns { key, publicUrl } using NEXT_PUBLIC_R2_PUBLIC_URL
*/

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function extFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export async function uploadProductImageToR2(file: File) {
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
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, WEBP images are allowed.");
  }
  if (file.size <= 0) throw new Error("Empty file.");
  if (file.size > MAX_BYTES) throw new Error("Image too large (max 5MB).");

  const key = `products/${crypto.randomUUID()}.${extFromMime(file.type)}`;
  const body = Buffer.from(await file.arrayBuffer());

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return { key, publicUrl: `${publicBase}/${key}` };
}
