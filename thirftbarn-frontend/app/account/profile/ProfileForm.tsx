"use client";

import { useEffect, useState } from "react";
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

type AddrOption = {
  place_id: string;
  formatted: string;
};

export default function ProfileForm({ userId, initial }: Props) {
  const supabase = createClient();

  const [fullName, setFullName] = useState(initial.full_name);
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [addrOptions, setAddrOptions] = useState<AddrOption[]>([]);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);


  useEffect(() => {
    const q = address.trim();
    if (q.length < 3) {
        setAddrOptions([]);
        setAddrOpen(false);
        return;
    }

    const t = setTimeout(async () => {
        setAddrLoading(true);
        try {
        const res = await fetch(`/api/address/autocomplete?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;

        const data = await res.json();
        const results = (data?.results || []).map((r: any) => ({
            place_id: r.place_id,
            formatted: r.formatted,
        }));

        setAddrOptions(results);
        setAddrOpen(results.length > 0);
        } finally {
        setAddrLoading(false);
        }
    }, 200);

    return () => clearTimeout(t);
    }, [address]);

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

      <div className={styles.kvRow} style={{ position: "relative" }}>
        <div className={styles.k}>Address</div>

        <div className={styles.v}>
            <input
            className={styles.input}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Start typing your address..."
            autoComplete="off"
            onFocus={() => {
                if (addrOptions.length) setAddrOpen(true);
            }}
            onBlur={() => {
                // delay so click selection works
                setTimeout(() => setAddrOpen(false), 120);
            }}
            />

            {addrOpen && addrOptions.length > 0 ? (
            <div className={styles.dropdown}>
                {addrOptions.map((opt) => (
                <button
                    key={opt.place_id}
                    type="button"
                    className={styles.dropdownItem}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                    setAddress(opt.formatted);
                    setAddrOpen(false);
                    }}
                >
                    {opt.formatted}
                </button>
                ))}
            </div>
            ) : null}

            {addrLoading ? (
            <div className={styles.mutedNote} style={{ marginTop: 6 }}>
                Looking up addresses…
            </div>
            ) : null}
        </div>
        </div>


      <div className={styles.rowActions}>
        <button className={styles.primaryBtn} onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        {msg ? <span className={styles.mutedNote}>{msg}</span> : null}
      </div>
    </div>
  );
}
