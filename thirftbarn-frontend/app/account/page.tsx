/*
Account dashboard: requires a logged-in user (requireUser()), then shows links/cards like Orders + Profile, using the user’s name/email for display.
*/

import Link from "next/link";
import styles from "./account.module.css";
import { requireUser } from "@/lib/require-user";
import DeleteAccountButton from "./DeleteAccountButton";

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
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <h1 className={styles.h1}>My Account</h1>
            <p className={styles.sub}>
              You are signed in as <strong>{displayName}</strong>
              {user.email ? <> ({user.email})</> : null}
            </p>
          </div>

          <div className={styles.actions}>
            <Link className={styles.actionBtn} href="/">
              Back to Store
            </Link>
            <Link className={styles.dangerBtn} href="/logout">
              Sign Out
            </Link>
          </div>
        </header>

        <h2 className={styles.sectionTitle}>QUICK LINKS</h2>

        <div className={styles.grid}>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Profile</h3>
            <p className={styles.cardText}>View your account details.</p>
            <div className={styles.cardLinkRow}>
              <Link className={styles.linkPill} href="/account/profile">
                Edit Profile <span aria-hidden>›</span>
              </Link>
            </div>
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Orders</h3>
            <p className={styles.cardText}>Review your previous purchases</p>
            <div className={styles.cardLinkRow}>
              <Link className={styles.linkPill} href="/account/orders">
                Order History <span aria-hidden>›</span>
              </Link>
            </div>
          </section>

          <section className={`${styles.card} ${styles.dangerCard}`}>
            <h3 className={styles.dangerTitle}>Danger Zone</h3>
            <p className={styles.cardText}>
              Permanently delete your account. This cannot be undone.
            </p>
            <DeleteAccountButton />
          </section>
        </div>
      </div>
    </main>
  );
}
