import Link from "next/link";

import styles from "../account.module.css";
import { requireUser } from "@/lib/require-user";

export default async function ProfilePage() {
  const { user } = await requireUser();

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "";

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

          <div className={styles.kv}>
            <div className={styles.kvRow}>
              <div className={styles.k}>Name</div>
              <div className={styles.v}>{name || "—"}</div>
            </div>
            <div className={styles.kvRow}>
              <div className={styles.k}>Email</div>
              <div className={styles.v}>{user.email || "—"}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
