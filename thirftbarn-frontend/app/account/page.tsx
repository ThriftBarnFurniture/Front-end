import Link from "next/link";

import styles from "./account.module.css";
import { requireUser } from "@/lib/require-user";

export default async function AccountHome() {
  const { user } = await requireUser();

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    "Account";

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h1 className={styles.h1}>My Account</h1>
            <p className={styles.sub}>
              Signed in as <strong>{displayName}</strong>
              {user.email ? <> ({user.email})</> : null}
            </p>
          </div>

          <div className={styles.actions}>
            <Link className={styles.ghostBtn} href="/">
              Back to store
            </Link>
            <Link className={styles.primaryBtn} href="/logout">
              Sign out
            </Link>
          </div>
        </div>

        <p className={styles.sectionTitle}>Quick links</p>

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Profile</h2>
            <p className={styles.cardText}>
              View your account details. (You can add editable fields later.)
            </p>
            <div className={styles.cardLinkRow}>
              <Link className={styles.linkPill} href="/account/profile">
                Edit profile →
              </Link>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Orders</h2>
            <p className={styles.cardText}>
              See your previous purchases once checkout is wired up.
            </p>
            <div className={styles.cardLinkRow}>
              <Link className={styles.linkPill} href="/account/orders">
                Order history →
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
