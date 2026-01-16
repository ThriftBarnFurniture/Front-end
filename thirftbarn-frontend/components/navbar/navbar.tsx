"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./navbar.module.css";
import { createClient } from "@/utils/supabase/client";
import { useCart } from "@/components/cart/CartProvider";


export const Navbar = () => {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const [googleReviewCount, setGoogleReviewCount] = useState<number | null>(null);


  // ---- NEW: auth state for the user icon ----
  const supabase = useMemo(() => createClient(), []);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  // ---- dropdown menu state ----
  const [accountOpen, setAccountOpen] = useState(false);
  const accountWrapRef = useRef<HTMLDivElement | null>(null);


  const goToSection = (id: string) => {
    if (pathname !== "/") {
      router.push(`/#${id}`);
      return;
    }

    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  //Google rating count
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/google/reviews-count", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count: number; rating: number };
        if (!cancelled) setGoogleReviewCount(Number(data.count) || 0);
      } catch {
        // ignore - fallback text will show
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);


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

  // ---- close account menu on outside click / Escape ----
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!accountOpen) return;
      const target = e.target as Node;
      if (accountWrapRef.current && !accountWrapRef.current.contains(target)) {
        setAccountOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);


  // ---- load user + react to login/logout ----
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const user = data.session?.user ?? null;
      setIsSignedIn(!!user);

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

  // ---- NEW: load admin flag from profiles.is_admin ----
  useEffect(() => {
    let cancelled = false;

    const loadAdmin = async () => {
      if (!isSignedIn) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!cancelled) {
        setIsAdmin(!error && !!profile?.is_admin);
      }
    };

    loadAdmin();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, supabase]);

  const onAccountClick = () => {
    setMobileOpen(false);
    // pick ONE:
    router.push("/account");
  };

  const onAdminOrdersClick = () => {
    setMobileOpen(false);
    setAccountOpen(false);
    router.push("/admin/orders");
  };


  const onSignOutClick = async () => {
    setMobileOpen(false);
    setAccountOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };


  return (
    <header className={`${styles.header} ${compact ? styles.headerCompact : ""}`}>
      {/* Announcement bar (collapses when header is compact) */}
      <div className={styles.announcement}>
        <div className={styles.marquee} aria-label="Store announcement">
          {Array.from({ length: 14 }).map((_, i) => (
            <span className={styles.marqueeItem} key={i}>
              {`${googleReviewCount ?? 250} 5-STAR REVIEWS ON GOOGLE • OPEN EVERY SAT & SUN FROM 12PM - 5PM`}
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
            {totalItems > 0 && (
              <span className={styles.cartBadge} aria-label={`${totalItems} items in cart`}>
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </Link>

          {/* NEW: User logo / name + menu */}
          <div className={styles.accountWrap} ref={accountWrapRef}>
            <button
              type="button"
              className={styles.userButton}
              aria-label={isSignedIn ? "Open account menu" : "Sign in"}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => {
                if (!isSignedIn) router.push("/login");
                else setAccountOpen((v) => !v);
              }}
            >
              {/* Signed out -> character image */}
              {!isSignedIn ? (
                <img src="/Icon-User.svg" alt="Guest" className={styles.userAvatar} />
              ) : (
                <span className={styles.userAvatarCircle} aria-hidden="true">
                  {(displayName?.trim()?.[0] ?? "U").toUpperCase()}
                </span>
              )}
            </button>

            {/* Dropdown (signed in only) */}
            {isSignedIn && accountOpen && (
              <div className={styles.accountMenu} role="menu">
                <button
                  type="button"
                  className={styles.accountMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    onAccountClick();
                  }}
                >
                  My account
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      className={styles.accountMenuItem}
                      role="menuitem"
                      onClick={() => {
                        setAccountOpen(false);
                        setMobileOpen(false);
                        router.push("/admin/products");
                      }}
                    >
                      Manage products
                    </button>

                    {/* NEW: Admin orders */}
                    <button
                      type="button"
                      className={styles.accountMenuItem}
                      role="menuitem"
                      onClick={onAdminOrdersClick}
                    >
                      Orders
                    </button>
                  </>
                )}
                <div className={styles.accountMenuDivider} />
                <button
                  type="button"
                  className={`${styles.accountMenuItem} ${styles.accountMenuDanger}`}
                  role="menuitem"
                  onClick={onSignOutClick}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

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
        {isAdmin && (
          <button
            type="button"
            className={styles.mobileLink}
            onClick={() => {
              setMobileOpen(false);
              router.push("/admin/orders");
            }}
          >
            Admin Orders
          </button>
        )}
      </div>
    </header>
  );
};
