// app/services/components/ServiceForm.tsx
"use client";

import { useId, useMemo, useState } from "react";
import styles from "./serviceform.module.css";
import { ErrorBox, SuccessBox } from "./shared";
import type { ServiceId } from "../services";
import { optimizeImageFieldInFormData } from "@/lib/image-upload-optimization";

const MAX_PHOTOS = 10;
const MAX_TOTAL_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB total before email encoding

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

async function optimizePhotosForUpload(fd: FormData) {
  return optimizeImageFieldInFormData(fd, {
    fieldName: "photos",
    maxFiles: MAX_PHOTOS,
    maxTotalBytes: MAX_TOTAL_PHOTO_BYTES,
    tooManyFilesMessage: `Please upload no more than ${MAX_PHOTOS} photos.`,
    tooLargeAfterCompressionMessage: `Photos are still too large after compression. Please keep the total under ${formatMegabytes(MAX_TOTAL_PHOTO_BYTES)}.`,
  });
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
