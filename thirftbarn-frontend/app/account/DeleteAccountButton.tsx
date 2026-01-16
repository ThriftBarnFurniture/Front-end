"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

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
      // If delete fails, user is already signed out, which is fine.
      alert(await res.text());
      router.push("/login");
      router.refresh();
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={onDelete}
      disabled={loading}
      style={{
        marginTop: 18,
        width: "100%",
        height: 44,
        borderRadius: 999,
        fontWeight: 800,
        border: "1px solid var(--color-border)",
        background: "transparent",
        color: "var(--color-text)",
      }}
    >
      {loading ? "Deleting..." : "Delete my account"}
    </button>
  );
}
