"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./navbar.module.css";

export const Navbar = () => {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  /**
   * Scroll to a section on the homepage.
   * - If we are NOT on "/", navigate to "/#section".
   * - If we are already on "/", smooth scroll to the element.
   */
  const goToSection = (id: string) => {
    if (pathname !== "/") {
      router.push(`/#${id}`);
      return;
    }

    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /**
   * Compact navbar once the hero is out of view (home page).
   * If there is no #hero on the page, do nothing.
   */
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;

    const obs = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { threshold: 0.02 }
    );

    obs.observe(hero);
    return () => obs.disconnect();
  }, [pathname]);

  /**
   * Close mobile menu when resizing up to desktop.
   * Prevents "menu stuck open" if user rotates / resizes.
   */
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 400) setMobileOpen(false);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header className={`${styles.header} ${compact ? styles.headerCompact : ""}`}>
      {/* Announcement bar (collapses when header is compact) */}
      <div className={styles.announcement}>
        <div className={styles.marquee} aria-label="Store announcement">
          {Array.from({ length: 14 }).map((_, i) => (
            <span className={styles.marqueeItem} key={i}>
              OVER 250 5 STAR REVIEWS ON GOOGLE • OPEN EVERY SAT & SUN FROM 12PM - 5PM
            </span>
          ))}
        </div>
      </div>

      <nav className={styles.navbar} aria-label="Main navigation">
        {/* Mobile hamburger (only visible under 400px via CSS) */}
        <button
          type="button"
          className={styles.menuButton}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>

        {/* Logo */}
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logo} aria-label="Go to home">
            <img src="/TBF_WideLogo.svg" alt="Thrift Barn Furniture" className={styles.logoImage} />
          </Link>
        </div>

        {/* Desktop links (hidden under 400px via CSS) */}
        <div className={styles.navLinks}>
          <Link href="/shop" className={styles.navButton}>
            Shop
          </Link>

          <button type="button" className={styles.navButton} onClick={() => goToSection("about")}>
            About
          </button>

          <button type="button" className={styles.navButton} onClick={() => goToSection("contact")}>
            Contact
          </button>
        </div>

        {/* Cart */}
        <div className={styles.cartContainer}>
          <Link href="/cart" className={styles.cartButton} aria-label="Go to cart">
            <img src="/Icon-Cart.svg" alt="Cart" className={styles.cartIcon} />
          </Link>
        </div>
      </nav>

      {/* Mobile dropdown (only visible under 400px via CSS) */}
      <div className={`${styles.mobileMenu} ${mobileOpen ? styles.mobileMenuOpen : ""}`}>
        <Link href="/shop" className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
          Shop
        </Link>

        <button
          type="button"
          className={styles.mobileLink}
          onClick={() => {
            setMobileOpen(false);
            goToSection("about");
          }}
        >
          About
        </button>

        <button
          type="button"
          className={styles.mobileLink}
          onClick={() => {
            setMobileOpen(false);
            goToSection("contact");
          }}
        >
          Contact
        </button>
      </div>
    </header>
  );
};
