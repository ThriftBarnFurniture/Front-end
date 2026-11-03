"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "./account.module.css";
import { errorMessage } from "@/lib/errors";

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

    try {
      // The server needs the current session to authorize the deletion.
      const res = await fetch("/api/account/delete", { method: "POST" });
      const payload = res.headers.get("content-type")?.includes("application/json")
        ? await res.json()
        : null;
      if (!res.ok || res.redirected || payload?.ok !== true) {
        throw new Error(payload?.error || (payload ? "Unable to delete your account." : await res.text()));
      }

      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      alert(errorMessage(error, "Unable to delete your account. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={onDelete} disabled={loading} className={styles.deleteBtn}>
      {loading ? "Deleting..." : "Delete my Account"}
    </button>
  );
}
