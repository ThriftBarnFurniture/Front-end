import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireUser } from "@/lib/require-user";
import PromoCreateForm from "./PromoCreateForm";
import RecentPromos, { type PromoRow } from "./RecentPromos";
import styles from "./promos.module.css";

export default async function AdminPromosPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) redirect("/");

  const { data: promos } = await supabase
    .from("promos")
    .select("id, code, percent_off, amount_off, is_active, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.h1}>Promo codes</h1>
          <p className={styles.subtitle}>
            Create or edit promo codes.
          </p>
        </header>

        <section className={styles.section}>
          <div className={styles.card}>
            <PromoCreateForm />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Recent</h2>
          <RecentPromos initialPromos={(promos ?? []) as PromoRow[]} />
        </section>
      </div>
    </main>
  );
}
