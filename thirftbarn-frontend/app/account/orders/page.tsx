/*
Orders page placeholder: requires login, but currently shows “no orders yet” messaging until you store orders in DB.
*/

import Link from "next/link";

import styles from "../account.module.css";
import { requireUser } from "@/lib/require-user";

export default async function OrdersPage() {
  await requireUser();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h1 className={styles.h1}>Order History</h1>
            <p className={styles.sub}>
              Once you add checkout, you can display your customer orders here.
            </p>
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
          <h2 className={styles.cardTitle}>No orders yet</h2>
          <p className={styles.cardText}>
            When you wire Stripe + order storage, this page will list items,
            totals, and dates.
          </p>
          <div className={styles.cardLinkRow}>
            <Link className={styles.linkPill} href="/shop">
              Browse the shop →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
