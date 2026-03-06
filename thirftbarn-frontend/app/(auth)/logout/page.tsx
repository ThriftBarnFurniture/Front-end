'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./logout.module.css";
import { createClient } from "@/utils/supabase/client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const run = async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        router.replace("/");
      }
    };

    run();
  }, [router]);

  return (
    <main className={styles.page}>
      <p className={styles.text}>Signing you out…</p>
      <p className={styles.sub}>Redirecting to the home page.</p>
    </main>
  );
}
