"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./checkout.module.css";
import { useCart } from "@/components/cart/CartProvider";
import { createClient } from "@/utils/supabase/client";
import { parsePhoneNumberFromString } from "libphonenumber-js";

type PromoRow = {
  code: string;
  percent_off: number | null;
  amount_off: number | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
};

type ShippingMethod = "" | "pickup" | "delivery";

type FieldErrors = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingMethod: string;
  street: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  promo: string;
}>;

const STORE_ADDRESS = "2786 ON-34  Hawkesbury, ON K6A 2R2";

function isValidEmail(v: string) {
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeAndValidatePhone(raw: string) {
  const trimmed = raw.trim();
  const p = parsePhoneNumberFromString(trimmed, "CA");
  if (!p || !p.isValid()) return { ok: false as const, e164: "" };
  return { ok: true as const, e164: p.number };
}

export default function CheckoutPage() {
  const supabase = useMemo(() => createClient(), []);

  const { items, subtotal } = useCart();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // checkout fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // promo
  const [promo, setPromo] = useState<PromoRow | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [promoStatus, setPromoStatus] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("");

  // delivery address fields (only if delivery)
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState(""); // state/province
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("Canada");

  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      if (!items.length) {
        window.location.href = "/cart";
        return;
      }

      // Prefill from auth/profile (optional)
      try {
        const res = await fetch("/api/checkout/prefill", { method: "GET" });
        if (res.ok) {
          const data = await res.json();

          const full = String(data?.full_name ?? "").trim();
          if (full && (!firstName || !lastName)) {
            const parts = full.split(" ").filter(Boolean);
            if (parts.length === 1) setFirstName(parts[0]);
            if (parts.length >= 2) {
              setFirstName(parts[0]);
              setLastName(parts.slice(1).join(" "));
            }
          }

          if (data?.email) setEmail(String(data.email));
          if (data?.phone) setPhone(String(data.phone));
        }
      } catch {
        // ignore
      }

      setLoading(false);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cartItemsCount = useMemo(
    () => items.reduce((sum, it) => sum + Math.max(1, Number(it.quantity || 1)), 0),
    [items]
  );

  // Shipping cost rules (matching what you did on cart page)
  const shippingCost = useMemo(() => {
    if (shippingMethod === "pickup") return 0;

    if (shippingMethod === "delivery") {
      const pc = postal.toUpperCase().replace(/\s+/g, "");
      if (!pc) return 0;

      if (/^[KLMNP]/.test(pc)) return 15;
      if (/^[HJG]/.test(pc)) return 20;
      return 30;
    }

    return 0;
  }, [shippingMethod, postal]);

  const promoDiscount = useMemo(() => {
    if (!promo) return 0;

    if (promo.percent_off != null) {
      const base = Math.max(0, subtotal + shippingCost);
      const pct = Math.max(0, Math.min(100, Number(promo.percent_off)));
      return Math.min(base, (base * pct) / 100);
    }

    if (promo.amount_off != null) {
      const base = Math.max(0, subtotal + shippingCost);
      const amt = Math.max(0, Number(promo.amount_off));
      return Math.min(base, amt);
    }

    return 0;
  }, [promo, subtotal, shippingCost]);

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    setPromoStatus(null);
    setFieldErrors((p) => ({ ...p, promo: undefined }));

    if (!code) {
      setPromo(null);
      setAppliedPromo("");
      setPromoStatus("Enter a promo code.");
      return;
    }

    setPromoLoading(true);

    try {
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("promos")
        .select("code,percent_off,amount_off,starts_at,ends_at,is_active")
        .ilike("code", code)
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setPromo(null);
        setAppliedPromo("");
        setPromoStatus("Invalid or expired promo code.");
        return;
      }

      setPromo(data as PromoRow);
      setAppliedPromo(code);
      setPromoStatus("Promo applied.");
    } catch (e: any) {
      setPromo(null);
      setAppliedPromo("");
      setPromoStatus(e?.message ?? "Promo lookup failed.");
    } finally {
      setPromoLoading(false);
    }
  };

  const taxableBase = Math.max(0, subtotal + shippingCost - promoDiscount);
  const taxes = 0;
  const totalCost = Math.max(0, taxableBase + taxes);

  const customerName = useMemo(() => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    return [fn, ln].filter(Boolean).join(" ").trim();
  }, [firstName, lastName]);

  const mergedShippingAddress = useMemo(() => {
    if (shippingMethod !== "delivery") return "";
    const parts = [street.trim(), city.trim(), region.trim(), postal.trim(), country.trim()].filter(Boolean);
    return parts.join(", ");
  }, [shippingMethod, street, city, region, postal, country]);

  const validateFields = () => {
    const errors: FieldErrors = {};

    if (!firstName.trim()) errors.firstName = "First name is required.";
    if (!lastName.trim()) errors.lastName = "Last name is required.";

    if (!email.trim()) errors.email = "Email is required.";
    else if (!isValidEmail(email)) errors.email = "Enter a valid email (e.g. name@example.com).";

    if (!phone.trim()) errors.phone = "Phone number is required.";
    else if (!normalizeAndValidatePhone(phone).ok) errors.phone = "Enter a valid phone number (e.g. 613-555-0123).";

    if (!shippingMethod) errors.shippingMethod = "Please select a shipping method.";

    if (shippingMethod === "delivery") {
      if (!street.trim()) errors.street = "Street address is required.";
      if (!city.trim()) errors.city = "City is required.";
      if (!region.trim()) errors.region = "Province is required.";
      if (!postal.trim()) errors.postal = "Postal code is required.";
      if (!country.trim()) errors.country = "Country is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canProceed = useMemo(() => {
    const okEmail = email.trim() && isValidEmail(email);
    const okPhone = phone.trim() && normalizeAndValidatePhone(phone).ok;

    if (!firstName.trim()) return false;
    if (!lastName.trim()) return false;
    if (!okEmail) return false;
    if (!okPhone) return false;
    if (!shippingMethod) return false;

    if (shippingMethod === "delivery") {
      if (!street.trim()) return false;
      if (!city.trim()) return false;
      if (!region.trim()) return false;
      if (!postal.trim()) return false;
      if (!country.trim()) return false;
    }

    return true;
  }, [firstName, lastName, email, phone, shippingMethod, street, city, region, postal, country]);

  const openConfirm = () => {
    setError(null);
    const ok = validateFields();
    if (!ok) {
      setError("Please fix the highlighted fields before proceeding.");
      return;
    }
    setConfirmOpen(true);
  };

  const proceedToPayment = async () => {
    setError(null);

    // final guard (in case user bypasses button)
    const ok = validateFields();
    if (!ok) {
      setError("Please fix the highlighted fields before proceeding.");
      return;
    }

    setSubmitting(true);

    try {
      const payloadItems = items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
      }));

      const phoneCheck = normalizeAndValidatePhone(phone);
      const phoneE164 = phoneCheck.ok ? phoneCheck.e164 : phone.trim();

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          customer_name: customerName,
          customer_email: email.trim(),
          customer_phone: phoneE164,
          shipping_method: shippingMethod,
          shipping_address: shippingMethod === "delivery" ? mergedShippingAddress : "",
          shipping_cost: shippingCost,
          promo_code: appliedPromo.trim(),
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json().catch(() => ({})) : null;

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
      <div className={styles.shell}>
        {/* LEFT: Checkout Info */}
        <section className={styles.leftCard}>
          <h1 className={styles.h1}>Checkout info</h1>

          {loading ? (
            <p className={styles.sub}>Loading…</p>
          ) : (
            <>
              <p className={styles.sub}>
                Fill out your info for this order. If you have a saved profile, we may autofill it for you.
              </p>

              <div className={styles.form}>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>First name</label>
                    <input
                      className={styles.input}
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setFieldErrors((p) => ({ ...p, firstName: undefined }));
                      }}
                      placeholder="John"
                      autoComplete="given-name"
                    />
                    {fieldErrors.firstName ? <div className={styles.fieldError}>{fieldErrors.firstName}</div> : null}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Last name</label>
                    <input
                      className={styles.input}
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setFieldErrors((p) => ({ ...p, lastName: undefined }));
                      }}
                      placeholder="Doe"
                      autoComplete="family-name"
                    />
                    {fieldErrors.lastName ? <div className={styles.fieldError}>{fieldErrors.lastName}</div> : null}
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input
                    className={styles.input}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFieldErrors((p) => ({ ...p, email: undefined }));
                    }}
                    onBlur={() => {
                      if (!email.trim()) setFieldErrors((p) => ({ ...p, email: "Email is required." }));
                      else if (!isValidEmail(email))
                        setFieldErrors((p) => ({ ...p, email: "Enter a valid email (e.g. name@example.com)." }));
                    }}
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                  />
                  {fieldErrors.email ? <div className={styles.fieldError}>{fieldErrors.email}</div> : null}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Phone number</label>
                  <input
                    className={styles.input}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setFieldErrors((p) => ({ ...p, phone: undefined }));
                    }}
                    onBlur={() => {
                      if (!phone.trim()) setFieldErrors((p) => ({ ...p, phone: "Phone number is required." }));
                      else if (!normalizeAndValidatePhone(phone).ok)
                        setFieldErrors((p) => ({ ...p, phone: "Enter a valid phone number (e.g. 613-555-0123)." }));
                    }}
                    placeholder="(613) 555-0123"
                    autoComplete="tel"
                  />
                  {fieldErrors.phone ? <div className={styles.fieldError}>{fieldErrors.phone}</div> : null}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Promo code</label>
                  <div className={styles.promoRow}>
                    <input
                      className={styles.input}
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="Enter your code"
                    />
                    <button
                      type="button"
                      className={styles.promoBtn}
                      onClick={applyPromo}
                      disabled={promoLoading}
                    >
                      {promoLoading ? "Checking…" : "Apply"}
                    </button>
                  </div>

                  {appliedPromo ? (
                    <div className={styles.promoHint}>
                      Applied: <strong>{appliedPromo.toUpperCase()}</strong>{" "}
                      {promoDiscount ? `(−$${promoDiscount.toFixed(2)})` : ""}
                    </div>
                  ) : null}

                  {promoStatus ? <div className={styles.promoHint}>{promoStatus}</div> : null}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Shipping method</label>
                  <select
                    className={styles.select}
                    value={shippingMethod}
                    onChange={(e) => {
                      const next = e.target.value as ShippingMethod;
                      setShippingMethod(next);
                      setError(null);
                      setFieldErrors((p) => ({ ...p, shippingMethod: undefined }));

                      if (next !== "delivery") {
                        setStreet("");
                        setCity("");
                        setRegion("");
                        setPostal("");
                        setFieldErrors((p) => ({
                          ...p,
                          street: undefined,
                          city: undefined,
                          region: undefined,
                          postal: undefined,
                          country: undefined,
                        }));
                        // keep country as-is
                      }
                    }}
                  >
                    <option value="">Select an option</option>
                    <option value="pickup">Store pickup</option>
                    <option value="delivery">House delivery</option>
                  </select>
                  {fieldErrors.shippingMethod ? (
                    <div className={styles.fieldError}>{fieldErrors.shippingMethod}</div>
                  ) : null}
                </div>

                {shippingMethod === "pickup" ? (
                  <div className={styles.pickupBox}>
                    <div className={styles.pickupTitle}>Store pickup location</div>
                    <div className={styles.pickupAddr}>{STORE_ADDRESS}</div>
                    <div className={styles.pickupNote}>
                      Shipping cost: <strong>$0.00</strong>
                    </div>
                  </div>
                ) : null}

                {shippingMethod === "delivery" ? (
                  <div className={styles.addressBox}>
                    <div className={styles.addressTitle}>Delivery address</div>

                    <div className={styles.field}>
                      <label className={styles.labelSmall}>Street name</label>
                      <input
                        className={styles.input}
                        value={street}
                        onChange={(e) => {
                          setStreet(e.target.value);
                          setFieldErrors((p) => ({ ...p, street: undefined }));
                        }}
                        placeholder="123 Main St"
                        autoComplete="shipping street-address"
                      />
                      {fieldErrors.street ? <div className={styles.fieldError}>{fieldErrors.street}</div> : null}
                    </div>

                    <div className={styles.grid2}>
                      <div className={styles.field}>
                        <label className={styles.labelSmall}>City</label>
                        <input
                          className={styles.input}
                          value={city}
                          onChange={(e) => {
                            setCity(e.target.value);
                            setFieldErrors((p) => ({ ...p, city: undefined }));
                          }}
                          placeholder="Ottawa"
                          autoComplete="shipping address-level2"
                        />
                        {fieldErrors.city ? <div className={styles.fieldError}>{fieldErrors.city}</div> : null}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.labelSmall}>State/Province</label>
                        <input
                          className={styles.input}
                          value={region}
                          onChange={(e) => {
                            setRegion(e.target.value);
                            setFieldErrors((p) => ({ ...p, region: undefined }));
                          }}
                          placeholder="Ontario"
                          autoComplete="shipping address-level1"
                        />
                        {fieldErrors.region ? <div className={styles.fieldError}>{fieldErrors.region}</div> : null}
                      </div>
                    </div>

                    <div className={styles.grid2}>
                      <div className={styles.field}>
                        <label className={styles.labelSmall}>Zip/Postal code</label>
                        <input
                          className={styles.input}
                          value={postal}
                          onChange={(e) => {
                            const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
                            setPostal(raw);
                            setFieldErrors((p) => ({ ...p, postal: undefined }));
                          }}
                          placeholder="K1A 0B1"
                          autoComplete="shipping postal-code"
                        />
                        {fieldErrors.postal ? <div className={styles.fieldError}>{fieldErrors.postal}</div> : null}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.labelSmall}>Country</label>
                        <input
                          className={styles.input}
                          value={country}
                          onChange={(e) => {
                            setCountry(e.target.value);
                            setFieldErrors((p) => ({ ...p, country: undefined }));
                          }}
                          placeholder="Canada"
                          autoComplete="shipping country-name"
                        />
                        {fieldErrors.country ? <div className={styles.fieldError}>{fieldErrors.country}</div> : null}
                      </div>
                    </div>

                    <div className={styles.deliveryHint}>
                      Estimated shipping: <strong>${shippingCost.toFixed(2)}</strong>
                    </div>
                  </div>
                ) : null}

                {error && <p className={styles.error}>{error}</p>}

                <button
                  className={styles.primaryBtn}
                  onClick={openConfirm}
                  disabled={!canProceed}
                  title={!canProceed ? "Fill out all required fields first" : "Proceed"}
                  type="button"
                >
                  Proceed with payment
                </button>
              </div>
            </>
          )}
        </section>

        {/* RIGHT: Cart Summary */}
        <aside className={styles.rightCard}>
          <div className={styles.summaryTop}>
            <h2 className={styles.summaryTitle}>Your cart</h2>
            <div className={styles.summaryCount}>{cartItemsCount} items</div>
          </div>

          <div className={styles.hr} />

          <div className={styles.cartList}>
            {items.map((it) => (
              <div key={it.productId} className={styles.cartRow}>
                <div className={styles.cartRowLeft}>
                  <div className={styles.thumb}>
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt={it.name} className={styles.thumbImg} />
                    ) : (
                      <div className={styles.thumbFallback} />
                    )}
                  </div>

                  <div className={styles.cartMeta}>
                    <div className={styles.cartName}>{it.name}</div>
                    <div className={styles.cartMuted}>Qty: {it.quantity}</div>
                    <div className={styles.cartMuted}>${it.price.toFixed(2)} each</div>
                  </div>
                </div>

                <div className={styles.cartPrice}>${(it.price * it.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className={styles.hr} />

          <div className={styles.calc}>
            <div className={styles.calcRow}>
              <span>Items Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <div className={styles.calcRow}>
              <span>Promo{appliedPromo ? ` (${appliedPromo.toUpperCase()})` : ""}</span>
              <span>{promoDiscount ? `-$${promoDiscount.toFixed(2)}` : "$0.00"}</span>
            </div>

            <div className={styles.calcRow}>
              <span>Shipping</span>
              <span>
                {shippingMethod === "pickup"
                  ? "FREE"
                  : shippingMethod === "delivery"
                  ? `$${shippingCost.toFixed(2)}`
                  : "$0.00"}
              </span>
            </div>

            <div className={styles.calcRow}>
              <span>Taxes</span>
              <span>${taxes.toFixed(2)}</span>
            </div>
          </div>

          <div className={styles.hr} />

          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>TOTAL</span>
            <span className={styles.totalValue}>${totalCost.toFixed(2)}</span>
          </div>

          <div className={styles.backNote}>
            Cart changes? Go back to <a href="/cart">Cart</a>.
          </div>
        </aside>
      </div>

      {/* Confirmation popup */}
      {confirmOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Proceed to payment?</h2>
            <p className={styles.modalText}>
              You will be redirected to a payment provider. Once you choose a payment method, you will be charged and
              the order will begin processing.
            </p>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                type="button"
              >
                Review information
              </button>

              <button
                className={styles.primaryBtn}
                onClick={proceedToPayment}
                disabled={submitting}
                type="button"
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
