"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./promos.module.css";

export type PromoRow = {
  id: string;
  code: string;
  percent_off: number | null;
  amount_off: number | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
};

type EditState = {
  id: string;
  code: string;
  percent_off: string;
  amount_off: string;
  is_active: boolean;
  timed_event: boolean;
  starts_at: string; // datetime-local
  ends_at: string;   // datetime-local
};

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function RecentPromos({ initialPromos }: { initialPromos: PromoRow[] }) {
  const [promos, setPromos] = useState<PromoRow[]>(initialPromos ?? []);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<PromoRow | null>(null);

  const [form, setForm] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discountLabel = useMemo(() => {
    if (!form) return "";
    const p = form.percent_off.trim();
    const a = form.amount_off.trim();
    if (p && !a) return `${p}% off`;
    if (a && !p) return `$${a} off`;
    if (p && a) return "Choose only one discount";
    return "Pick a discount type";
  }, [form]);

  function openModal(p: PromoRow) {
    setActive(p);
    setError(null);
    setOpen(true);

    setForm({
      id: p.id,
      code: p.code ?? "",
      percent_off: p.percent_off == null ? "" : String(p.percent_off),
      amount_off: p.amount_off == null ? "" : String(p.amount_off),
      is_active: !!p.is_active,
      timed_event: !!(p.starts_at || p.ends_at),
      starts_at: toLocalInputValue(p.starts_at),
      ends_at: toLocalInputValue(p.ends_at),
    });
  }

  function closeModal() {
    setOpen(false);
    setActive(null);
    setForm(null);
    setError(null);
    setSaving(false);
    setDeleting(false);
  }

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function onUpdate() {
    if (!form) return;
    setSaving(true);
    setError(null);

    const payload = {
      id: form.id,
      code: form.code.trim().toUpperCase().replace(/\s+/g, "-"),
      percent_off: form.percent_off.trim() || null,
      amount_off: form.amount_off.trim() || null,
      is_active: form.is_active,
      starts_at: form.timed_event ? form.starts_at || null : null,
      ends_at: form.timed_event ? form.ends_at || null : null,
    };

    try {
      const res = await fetch("/api/admin/promos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update promo");

      const updated: PromoRow = json.promo;
      setPromos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      closeModal();
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!form) return;
    const ok = window.confirm(`Delete promo "${form.code}"? This cannot be undone.`);
    if (!ok) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/promos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: form.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to delete promo");

      setPromos((prev) => prev.filter((x) => x.id !== form.id));
      closeModal();
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className={styles.list}>
        {promos.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.promoRow} ${styles.promoRowButton}`}
            onClick={() => openModal(p)}
          >
            <div className={styles.promoLeft}>
              <div className={styles.promoCode}>{p.code}</div>
              <div className={styles.promoMeta}>
                {p.percent_off != null
                  ? `${p.percent_off}% off`
                  : p.amount_off != null
                  ? `$${Number(p.amount_off).toFixed(2)} off`
                  : "—"}
                {" · "}
                {p.is_active ? "Active" : "Inactive"}
              </div>
              <div className={styles.promoDates}>
                {p.starts_at ? `Starts: ${new Date(p.starts_at).toLocaleString()}` : "No start"}
                {" · "}
                {p.ends_at ? `Ends: ${new Date(p.ends_at).toLocaleString()}` : "No end"}
              </div>
            </div>
          </button>
        ))}

        {promos.length === 0 && <div className={styles.empty}>No promos yet.</div>}
      </div>

      {open && form && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            // click outside closes
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Edit promo</div>
              <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div>
                <label className={styles.label}>
                  Code
                  <input
                    className={styles.input}
                    value={form.code}
                    onChange={(e) => setForm((f) => (f ? { ...f, code: e.target.value } : f))}
                    placeholder="WELCOME10"
                    required
                  />
                </label>
                <div className={styles.help}>
                  Saved as:{" "}
                  <b>{form.code.trim().toUpperCase().replace(/\s+/g, "-") || "—"}</b>
                </div>
              </div>

              <div className={styles.row2}>
                <label className={styles.label}>
                  % off
                  <input
                    className={styles.input}
                    value={form.percent_off}
                    onChange={(e) =>
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              percent_off: e.target.value,
                              amount_off: e.target.value.trim() ? "" : f.amount_off,
                            }
                          : f
                      )
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
                      setForm((f) =>
                        f
                          ? {
                              ...f,
                              amount_off: e.target.value,
                              percent_off: e.target.value.trim() ? "" : f.percent_off,
                            }
                          : f
                      )
                    }
                    placeholder="5"
                    inputMode="decimal"
                  />
                </label>
              </div>

              <div className={styles.badgeLine}>
                Discount: <b>{discountLabel}</b>
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.timed_event}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            timed_event: checked,
                            ...(checked ? {} : { starts_at: "", ends_at: "" }),
                          }
                        : f
                    );
                  }}
                />
                Timed Event
              </label>

              {form.timed_event && (
                <div className={styles.row2}>
                  <label className={styles.label}>
                    Starts at
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(e) => setForm((f) => (f ? { ...f, starts_at: e.target.value } : f))}
                    />
                  </label>

                  <label className={styles.label}>
                    Ends at
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(e) => setForm((f) => (f ? { ...f, ends_at: e.target.value } : f))}
                    />
                  </label>
                </div>
              )}

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => (f ? { ...f, is_active: e.target.checked } : f))}
                />
                Active
              </label>

              {error && <div className={styles.alertError}>{error}</div>}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.button}
                onClick={onUpdate}
                disabled={saving || deleting}
              >
                {saving ? "Updating..." : "Update"}
              </button>

              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                onClick={onDelete}
                disabled={saving || deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
