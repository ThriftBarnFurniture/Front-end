/*
Profile page: requires login, loads profile row from Supabase, renders editable form.
*/

import Link from "next/link";
import styles from "../account.module.css";
import { requireUser } from "@/lib/require-user";
import { createClient } from "@/utils/supabase/server";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name,phone,address")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Keep it simple; you can improve UX later
    throw new Error(error.message);
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h1 className={styles.h1}>Profile</h1>
            <p className={styles.sub}>Your saved account details.</p>
          </div>

          <div className={styles.actions}>
            <Link className={styles.ghostBtn} href="/account">
              Back
            </Link>
            <Link className={styles.primaryBtn} href="/logout">
              Sign out
            </Link>
          </div>
        </div>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Account details</h2>

          <ProfileForm
            userId={user.id}
            initial={{
              full_name: profile?.full_name ?? "",
              email: user.email ?? "",
              phone: profile?.phone ?? "",
              address: profile?.address ?? "",
            }}
          />
        </section>
      </div>
    </main>
  );
}
