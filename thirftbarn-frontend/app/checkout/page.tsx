"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./checkout.module.css";
import { useCart } from "@/components/cart/CartProvider";

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const { items } = useCart();
  const [submitting, setSubmitting] = useState(false);

  // form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [error, setError] = useState<string | null>(null);

  // popup
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      // If cart is empty, send back to cart page
      if (!items.length) {
        window.location.href = "/cart";
        return;
      }


      // 2) Prefill from auth + profiles (if signed in)
      try {
        const res = await fetch("/api/checkout/prefill", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data?.full_name) setFullName(String(data.full_name));
          if (data?.email) setEmail(String(data.email));
          if (data?.phone) setPhone(String(data.phone));
          if (data?.address) setAddress(String(data.address));
        }
      } catch {
        // prefill is optional
      }

      setLoading(false);
    };

    run();
  }, []);

  const canProceed = useMemo(() => {
    return (
      !!fullName.trim() &&
      !!email.trim() &&
      !!phone.trim() &&
      !!address.trim()
    );
  }, [fullName, email, phone, address]);

  const openConfirm = () => {
    setError(null);
    if (!canProceed) {
      setError("Please fill out all fields before proceeding.");
      return;
    }
    setConfirmOpen(true);
  };

  const proceedToPayment = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const payloadItems = items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
      }));


      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          customer_name: fullName.trim(),
          customer_email: email.trim(),
          customer_phone: phone.trim(),
          shipping_address: address.trim(),
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : null;

      if (!res.ok) {
        const text = data ? (data as any).error : await res.text();
        throw new Error(text || "Checkout failed.");
      }

      if (data && (data as any).url) {
        window.location.href = (data as any).url;
        return;
      }

      throw new Error("Stripe session missing url.");

    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.h1}>Checkout info</h1>

        {loading ? (
          <p className={styles.sub}>Loading…</p>
        ) : (
          <>
            <p className={styles.sub}>
              Fill out your info for this order. If you have a saved profile, we
              may autofill it for you.
            </p>

            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Full name</label>
                <input
                  className={styles.input}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Phone number</label>
                <input
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(613) 555-0123"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Shipping address</label>
                <textarea
                  className={styles.textarea}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, city, province, postal code"
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button
                className={styles.primaryBtn}
                onClick={openConfirm}
                disabled={!canProceed}
                title={!canProceed ? "Fill out all fields first" : "Proceed"}
              >
                Proceed with payment
              </button>
            </div>
          </>
        )}
      </div>

      {/* Confirmation popup */}
      {confirmOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Proceed to payment?</h2>
            <p className={styles.modalText}>
              You will be redirected to a payment provider. Once you fill out
              your preferred payment method, you will be charged and the order
              will begin processing.
            </p>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                Review information
              </button>

              <button
                className={styles.primaryBtn}
                onClick={proceedToPayment}
                disabled={submitting}
              >
                {submitting ? "Redirecting…" : "Proceed with payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
