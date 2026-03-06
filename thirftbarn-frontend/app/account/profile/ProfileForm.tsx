"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "../account.module.css";
import { parsePhoneNumberFromString } from "libphonenumber-js";

type Props = {
  userId: string;
  initial: {
    full_name: string;
    email: string; // display-only
    phone: string;
    address: string; // stored merged string
  };
};

function splitFullName(full: string) {
  const clean = String(full ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function parseAddressString(addr: string) {
  // Expected stored format (from checkout): "street, city, region, postal, country"
  // We'll best-effort parse by commas.
  const parts = String(addr ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    street: parts[0] ?? "",
    city: parts[1] ?? "",
    region: parts[2] ?? "",
    postal: parts[3] ?? "",
    country: parts[4] ?? "Canada",
  };
}

function normalizeAndValidatePhone(raw: string) {
  const trimmed = raw.trim();
  const p = parsePhoneNumberFromString(trimmed, "CA");
  if (!p || !p.isValid()) return { ok: false as const, e164: "" };
  return { ok: true as const, e164: p.number };
}

function buildMergedAddress(street: string, city: string, region: string, postal: string, country: string) {
  const parts = [street, city, region, postal, country].map((s) => s.trim()).filter(Boolean);
  return parts.join(", ");
}

export default function ProfileForm({ userId, initial }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const initialName = splitFullName(initial.full_name);
  const initialAddr = parseAddressString(initial.address);

  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);

  const [phone, setPhone] = useState(initial.phone);

  const [street, setStreet] = useState(initialAddr.street);
  const [city, setCity] = useState(initialAddr.city);
  const [region, setRegion] = useState(initialAddr.region);
  const [postal, setPostal] = useState(initialAddr.postal);
  const [country, setCountry] = useState(initialAddr.country || "Canada");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSave = async () => {
    setSaving(true);
    setMsg(null);

    // Build fields in the exact same shape checkout expects.
    const full_name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
    const mergedAddress = buildMergedAddress(street, city, region, postal, country);

    // (Optional) normalize phone to E.164 if valid; otherwise keep raw
    const phoneCheck = normalizeAndValidatePhone(phone);
    const phoneToStore = phoneCheck.ok ? phoneCheck.e164 : phone.trim();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: full_name || null,
        phone: phoneToStore || null,
        address: mergedAddress || null,
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Saved!");
  };

  return (
    <div className={styles.kv}>
      <div className={styles.kvRow}>
        <div className={styles.k}>Name</div>
        <div className={`${styles.v} ${styles.inlineGrid}`}>
          <input
            className={styles.input}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            autoComplete="given-name"
          />
          <input
            className={styles.input}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className={styles.kvRow}>
        <div className={styles.k}>Email</div>
        <div className={styles.v}>{initial.email || "—"}</div>
      </div>

      <div className={styles.kvRow}>
        <div className={styles.k}>Phone</div>
        <div className={styles.v}>
          <input
            className={styles.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(613) 555-0123"
            autoComplete="tel"
          />
        </div>
      </div>

      <div className={styles.kvRow}>
        <div className={styles.k}>Address</div>
        <div className={`${styles.v} ${styles.inlineGrid}`}>
          <input
            className={styles.input}
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="123 Main St • Apt / Unit"
            autoComplete="shipping street-address"
          />
          <input
            className={styles.input}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            autoComplete="shipping address-level2"
          />
        </div>
      </div>

      <div className={styles.kvRow}>
        <div className={styles.k}>Region</div>
          <div className={`${styles.v} ${styles.inlineGrid}`}>
            <input
              className={styles.input}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Province"
              autoComplete="shipping address-level1"
            />
            <input
              className={styles.input}
              value={postal}
              onChange={(e) => {
                const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
                setPostal(raw);
              }}
              placeholder="Postal code"
              autoComplete="shipping postal-code"
            />
            <input
              className={styles.input}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              autoComplete="shipping country-name"
            />
          </div>
        </div>


      <div className={styles.rowActions}>
        <button className={styles.dangerBtn} onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        {msg ? <span className={styles.mutedNote}>{msg}</span> : null}
      </div>
    </div>
  );
}
