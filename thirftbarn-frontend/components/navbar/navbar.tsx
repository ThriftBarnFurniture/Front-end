"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./navbar.module.css";
import { createClient } from "@/utils/supabase/client";

export const Navbar = () => {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  // ---- NEW: auth state for the user icon ----
  const supabase = useMemo(() => createClient(), []);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const goToSection = (id: string) => {
    if (pathname !== "/") {
      router.push(`/#${id}`);
      return;
    }

    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 400) setMobileOpen(false);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- NEW: load user + react to login/logout ----
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const user = data.user;
      setIsSignedIn(!!user);

      // Prefer name, then email
      const name =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        user?.email ||
        null;

      setDisplayName(name);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setIsSignedIn(!!user);

      const name =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        user?.email ||
        null;

      setDisplayName(name);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const onAccountClick = () => {
    setMobileOpen(false);
    // pick ONE:
    router.push("/account"); // if you create app/account/page.tsx as a hub
    // router.push("/account/profile"); // if you want direct profile
  };

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

        {/* Right side: Cart + User */}
        <div className={styles.rightActions}>
          {/* Cart */}
          <Link href="/cart" className={styles.cartButton} aria-label="Go to cart">
            <img src="/Icon-Cart.svg" alt="Cart" className={styles.cartIcon} />
          </Link>

          {/* NEW: User logo / name */}
          <button
            type="button"
            className={styles.userButton}
            aria-label={isSignedIn ? "Open account" : "Sign in"}
            onClick={() => {
              if (!isSignedIn) router.push("/login");
              else onAccountClick();
            }}
          >
            {/* Signed out -> character image */}
            {!isSignedIn ? (
              <img
                src="/Icon-User.svg"
                alt="Guest"
                className={styles.userAvatar}
              />
            ) : (
              <>
                <span className={styles.userAvatarCircle} aria-hidden="true">
                  {(displayName?.trim()?.[0] ?? "U").toUpperCase()}
                </span>
              </>
            )}
          </button>
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

        {/* NEW: mobile account entry */}
        <button
          type="button"
          className={styles.mobileLink}
          onClick={() => {
            if (!isSignedIn) router.push("/login");
            else onAccountClick();
          }}
        >
          {isSignedIn ? "My account" : "Login"}
        </button>
      </div>
    </header>
  );
};
