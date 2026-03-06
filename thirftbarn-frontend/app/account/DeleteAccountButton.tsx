"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "./account.module.css";

export default function DeleteAccountButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    const ok = window.confirm(
      "Delete your account permanently? This cannot be undone."
    );
    if (!ok) return;

    setLoading(true);

    // 1) Sign out FIRST so UI immediately flips to guest mode
    await supabase.auth.signOut();

    // 2) Then delete on server (uses admin key)
    const res = await fetch("/api/account/delete", { method: "POST" });

    setLoading(false);

    if (!res.ok) {
      alert(await res.text());
      router.push("/login");
      router.refresh();
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <button onClick={onDelete} disabled={loading} className={styles.deleteBtn}>
      {loading ? "Deleting..." : "Delete my Account"}
    </button>
  );
}
