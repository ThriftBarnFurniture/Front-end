"use client";

import { useMemo, useState } from "react";
import styles from "./promos.module.css";

type PromoPayload = {
  code: string;
  percent_off: string;
  amount_off: string;
  is_active: boolean;
  timed_event: boolean; // NEW
  starts_at: string;
  ends_at: string;
};

export default function PromoCreateForm() {
  const [form, setForm] = useState<PromoPayload>({
    code: "",
    percent_off: "",
    amount_off: "",
    is_active: true,
    timed_event: false, // NEW default
    starts_at: "",
    ends_at: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const normalizedCode = useMemo(() => {
    return form.code.trim().toUpperCase().replace(/\s+/g, "-");
  }, [form.code]);

  const discountLabel = useMemo(() => {
    const p = form.percent_off.trim();
    const a = form.amount_off.trim();
    if (p && !a) return `${p}% off`;
    if (a && !p) return `$${a} off`;
    if (p && a) return "Choose only one discount";
    return "Pick a discount type";
  }, [form.percent_off, form.amount_off]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    const payload = {
      code: normalizedCode,
      percent_off: form.percent_off.trim() || null,
      amount_off: form.amount_off.trim() || null,
      is_active: form.is_active,
      starts_at: form.timed_event ? form.starts_at || null : null,
      ends_at: form.timed_event ? form.ends_at || null : null,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/admin/promos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create promo");

      setOk(`Created ${json.promo.code}`);
      setForm({
        code: "",
        percent_off: "",
        amount_off: "",
        is_active: true,
        timed_event: false,
        starts_at: "",
        ends_at: "",
      });

      window.location.reload();
    } catch (err: any) {
      setError(err?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.grid}>
      <div>
        <label className={styles.label}>
          Code
          <input
            className={styles.input}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="WELCOME10"
            required
          />
        </label>
        <div className={styles.help}>
          Saved as: <b>{normalizedCode || "—"}</b>
        </div>
      </div>

      <div className={styles.row2}>
        <label className={styles.label}>
          % off
          <input
            className={styles.input}
            value={form.percent_off}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                percent_off: e.target.value,
                amount_off: e.target.value.trim() ? "" : f.amount_off, // clear $ if % set
              }))
            }
            placeholder="10"
            inputMode="decimal"
          />
        </label>

        <label className={styles.label}>
          $ off
          <input
            className={styles.input}
            value={form.amount_off}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                amount_off: e.target.value,
                percent_off: e.target.value.trim() ? "" : f.percent_off, // clear % if $ set
              }))
            }
            placeholder="5"
            inputMode="decimal"
          />
        </label>
      </div>

      <div className={styles.badgeLine}>
        Discount: <b>{discountLabel}</b>
      </div>

      {/* NEW: Timed Event toggle */}
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={form.timed_event}
          onChange={(e) => {
            const checked = e.target.checked;
            setForm((f) => ({
              ...f,
              timed_event: checked,
              ...(checked ? {} : { starts_at: "", ends_at: "" }), // clear dates if turning off
            }));
          }}
        />
        Timed Event
      </label>

      {/* Conditionally show dates */}
      {form.timed_event && (
        <div className={styles.row2}>
          <label className={styles.label}>
            Starts at
            <input
              className={styles.input}
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
            />
          </label>

          <label className={styles.label}>
            Ends at
            <input
              className={styles.input}
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
            />
          </label>
        </div>
      )}

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
        />
        Active
      </label>

      {error && <div className={styles.alertError}>{error}</div>}
      {ok && <div className={styles.alertOk}>{ok}</div>}

      <button type="submit" className={styles.button} disabled={saving}>
        {saving ? "Creating..." : "Create promo"}
      </button>
    </form>
  );
}
