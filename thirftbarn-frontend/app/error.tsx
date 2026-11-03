"use client";

import Link from "next/link";
import styles from "./error/error.module.css";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={styles.page} role="alert">
      <h1>We couldn&apos;t load this page</h1>
      <p>Please try again. If the problem continues, contact the store for help.</p>
      <button type="button" onClick={reset}>Try again</button>
      <Link href="/">Return home</Link>
    </div>
  );
}
