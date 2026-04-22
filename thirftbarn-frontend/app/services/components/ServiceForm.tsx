// app/services/components/ServiceForm.tsx
"use client";

import { useId, useMemo, useState } from "react";
import styles from "./serviceform.module.css";
import { ErrorBox, SuccessBox } from "./shared";
import type { ServiceId } from "../services";

const MAX_PHOTOS = 10;
const MAX_TOTAL_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB total before email encoding
const MAX_OUTPUT_DIMENSION = 1600;
const MIN_TARGET_BYTES = 180 * 1024;
const SCALE_STEPS = [1, 0.9, 0.8, 0.7, 0.6];
const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

function replaceExtension(name: string, nextExt: string) {
  const clean = name.trim() || "photo";
  return clean.includes(".")
    ? clean.replace(/\.[^.]+$/u, nextExt)
    : `${clean}${nextExt}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to optimize one of the photos."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "One of the photos could not be processed. Please use JPG, PNG, or WEBP images."
        )
      );
    };

    img.src = url;
  });
}

async function optimizePhoto(file: File, targetBytes: number) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be uploaded.");
  }

  if (file.size <= targetBytes) return file;

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const baseScale = longestSide > MAX_OUTPUT_DIMENSION ? MAX_OUTPUT_DIMENSION / longestSide : 1;

  let bestCandidate: File | null = null;

  for (const scaleStep of SCALE_STEPS) {
    const scale = Math.min(1, baseScale * scaleStep);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image optimization is not supported in this browser.");

    // JPEG keeps file sizes predictable; fill the canvas to avoid dark transparency output.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      const candidate = new File([blob], replaceExtension(file.name, ".jpg"), {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });

      if (!bestCandidate || candidate.size < bestCandidate.size) {
        bestCandidate = candidate;
      }
      if (candidate.size <= targetBytes) {
        return candidate;
      }
    }
  }

  return bestCandidate ?? file;
}

async function optimizePhotosForUpload(fd: FormData) {
  const photos = fd.getAll("photos").filter((value) => value instanceof File) as File[];

  if (!photos.length) return fd;
  if (photos.length > MAX_PHOTOS) {
    throw new Error(`Please upload no more than ${MAX_PHOTOS} photos.`);
  }

  const currentTotal = photos.reduce((sum, file) => sum + file.size, 0);
  if (currentTotal <= MAX_TOTAL_PHOTO_BYTES) {
    return fd;
  }

  const next = new FormData();
  for (const [key, value] of fd.entries()) {
    if (key === "photos" && value instanceof File) continue;
    next.append(key, value);
  }

  const optimized: File[] = [];
  let optimizedTotal = 0;

  for (let index = 0; index < photos.length; index += 1) {
    const remainingBudget = MAX_TOTAL_PHOTO_BYTES - optimizedTotal;
    const remainingPhotos = photos.length - index;
    const targetBytes = Math.max(
      MIN_TARGET_BYTES,
      Math.floor(remainingBudget / Math.max(1, remainingPhotos))
    );

    const file = await optimizePhoto(photos[index], targetBytes);
    optimized.push(file);
    optimizedTotal += file.size;
  }

  if (optimizedTotal > MAX_TOTAL_PHOTO_BYTES) {
    throw new Error(
      `Photos are still too large after compression. Please keep the total under ${formatMegabytes(MAX_TOTAL_PHOTO_BYTES)}.`
    );
  }

  for (const file of optimized) {
    next.append("photos", file);
  }

  return next;
}

export default function ServiceForm({
  serviceId,
  children,
}: {
  serviceId: ServiceId;
  children: React.ReactNode;
}) {
  const formId = useId();
  const [submitState, setSubmitState] = useState<"idle" | "compressing" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const humanName = useMemo(() => {
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
        return "Service";
    }
  }, [serviceId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const formEl = e.currentTarget;
    const fd = new FormData(formEl);

    // Always include selected service
    fd.set("service_id", serviceId);

    // Basic bot-trap (hidden field)
    const honey = (fd.get("website") ?? "").toString().trim();
    if (honey.length > 0) {
      // Pretend success but do nothing
      setSuccessMsg("Thanks! A member of the Barn will reach out soon.");
      formEl.reset();
      return;
    }

    try {
      setSubmitState("compressing");
      const payloadFd = await optimizePhotosForUpload(fd);
      setSubmitState("sending");

      const res = await fetch("/api/services", {
        method: "POST",
        body: payloadFd, // multipart/form-data automatically
      });

      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;

      if (!res.ok) {
        const msg =
          payload?.error ||
          payload?.message ||
          "Something went wrong (most likely too many images or too big files). Please try again.";
        throw new Error(msg);
      }

      setSuccessMsg(
        payload?.message ||
          `Thanks for the details! A member of the Barn will reach out soon for booking (${humanName}).`
      );
      formEl.reset();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setSubmitState("idle");
    }
  }

  return (
    <form
      id={formId}
      className={styles.form}
      onSubmit={onSubmit}
      encType="multipart/form-data"
    >
      {/* Bot trap */}
      <input
        className={styles.honey}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      {/* Service id (also set in submit) */}
      <input type="hidden" name="service_id" value={serviceId} />

      <div className={styles.formBody}>{children}</div>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.primaryBtn}
          disabled={submitState !== "idle"}
        >
          {submitState === "compressing"
            ? "Optimizing photos..."
            : submitState === "sending"
            ? "Sending..."
            : "Send Request"}
        </button>

        {error ? <ErrorBox message={error} /> : null}
        {successMsg ? <SuccessBox message={successMsg} /> : null}

        <div className={styles.actionsHint}>
          You’ll receive a confirmation email with the details you submitted.
        </div>
      </div>
    </form>
  );
}
