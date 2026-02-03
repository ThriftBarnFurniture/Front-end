"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "../account.module.css";

type Props = {
  userId: string;
  initial: {
    full_name: string;
    email: string; // display-only
    phone: string;
    address: string;
  };
};

export default function ProfileForm({ userId, initial }: Props) {
  const supabase = createClient();

  const [fullName, setFullName] = useState(initial.full_name);
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSave = async () => {
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
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
        <div className={styles.v}>
          <input
            className={styles.input}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
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
            placeholder="Optional"
            autoComplete="tel"
          />
        </div>
      </div>

      <div className={styles.kvRow}>
        <div className={styles.k}>Address</div>
        <div className={styles.v}>
          <input
            className={styles.input}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            autoComplete="street-address"
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
