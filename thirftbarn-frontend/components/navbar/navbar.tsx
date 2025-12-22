// Navbar.tsx (same file you currently have)
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./navbar.module.css";

export const Navbar = () => {
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  useEffect(() => {
    // Pull from your own API route (we’ll add it below)
    fetch("/api/google-reviews")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.total === "number") setReviewCount(d.total);
      })
      .catch(() => {
        // silently fallback
      });
  }, []);

  const marqueeText = useMemo(() => {
    const countText = reviewCount ? `${reviewCount}+` : "250+";
    return `OVER ${countText} 5 STAR REVIEWS ON GOOGLE`;
  }, [reviewCount]);

  return (
    <header className={styles.header}>
      {/* Announcement Bar - Rolling */}
      <div className={styles.announcement} aria-label={marqueeText}>
        <div className={styles.marquee}>
          {/* Repeat enough times to feel “infinite” */}
          {Array.from({ length: 14 }).map((_, i) => (
            <span className={styles.marqueeItem} key={i}>
              {marqueeText}
            </span>
          ))}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className={styles.navbar}>
        {/* Logo - Far Left */}
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logo}>
            <img src="/TBF_WideLogo.svg" alt="TBF" className={styles.logoImage} />
          </Link>
        </div>

        {/* Navigation Links - Middle */}
        <div className={styles.navLinks}>
          <Link href="/shop" className={styles.navButton}>
            Shop
          </Link>
          <Link href="/about" className={styles.navButton}>
            About
          </Link>
          <Link href="/contact" className={styles.navButton}>
            Contact
          </Link>
        </div>

        {/* Cart Button - Far Right */}
        <div className={styles.cartContainer}>
          <Link href="/cart" className={styles.cartButton}>
            <img src="/Icon-Cart.svg" alt="Cart" />
          </Link>
        </div>
      </nav>
    </header>
  );
};
