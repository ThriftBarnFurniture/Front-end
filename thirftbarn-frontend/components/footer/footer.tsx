import Image from "next/image";
import Link from "next/link";
import styles from "./footer.module.css";

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <section className={styles.bottomBar}>
        <div className={styles.bottomInner}>
          {/* COL 1: Brand */}
          <div className={styles.colBrand}>
            <Image
              src="/TBF_Wide-OnDark.svg"
              alt="Thrift Barn Furniture"
              width={230}
              height={70}
              className={styles.brandLogo}
            />
            <div className={styles.copyright}>
              © Thrift Barn Furniture, {new Date().getFullYear()}
            </div>
            <div className={styles.colPolicyLarge}>
              <div className={styles.policyListLarge}>
                <Link href="/privacy" className={styles.footerLink}>
                  Privacy Policy
                </Link>
                <Link href="/terms" className={styles.footerLink}>
                  Terms and Conditions
                </Link>
              </div>
            </div>
          </div>

          {/* COL 2: Links */}
          <div className={styles.colLinks}>
            <div className={styles.colTitle}>LINKS</div>
            <div className={styles.colUnderline} />
            <nav className={styles.linkList} aria-label="Footer links">
              <Link href="/" className={styles.footerLink}>Home</Link>
              <Link href="/shop" className={styles.footerLink}>Shop Furniture</Link>
              <Link href="/#about" className={styles.footerLink}>About Us</Link>
              <Link href="/#contact" className={styles.footerLink}>Contact</Link>
            </nav>
          </div>

          {/* COL 3: Contact */}
          <div className={styles.colContact}>
            <div className={styles.colTitle}>CONTACT US</div>
            <div className={styles.colUnderline} />

            <div className={styles.contactGrid}>
              <div className={styles.contactLabel}>ADDRESS:</div>
              <div className={styles.contactValue}>
                2786 ON-34, Hawkesbury, ON, K6A 2R2
              </div>

              <div className={styles.contactLabel}>IN-STORE HOURS:</div>
              <div className={styles.contactValue}>
                <div className={styles.hoursRow}>
                  <span>Weekdays: By Appointment</span>
                </div>
                <div className={styles.hoursRow}>
                  <span>Weekends: 12:00-5:00 PM</span>
                </div>
              </div>

              <div className={styles.contactLabel}>PHONE:</div>
              <div className={styles.contactValue}>
                <a className={styles.footerLink} href="tel:6139153889">
                  613-915-3889 (DUTY)
                </a>
              </div>
            </div>
          </div>

          {/* COL 4: Follow */}
          <div className={styles.colFollow}>
            <div className={styles.colTitle}>FOLLOW US</div>
            <div className={styles.colUnderline} />

            <div className={styles.followRow}>
              <a
                href="https://www.facebook.com/groups/961935455087635/"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className={styles.iconButton}
              >
                <Image
                  src="/facebook-circle-fill.svg"
                  alt=""
                  width={22}
                  height={22}
                  className={styles.icon}
                />
              </a>

              <a
                href="https://www.facebook.com/groups/961935455087635/"
                target="_blank"
                rel="noreferrer"
                className={styles.footerLink}
              >
                Find us on Facebook
              </a>
            </div>
          </div>
          <div className={styles.colPolicy}>
            <div className={styles.policyList}>
              <Link href="/privacy" className={styles.footerLink}>
                Privacy Policy
              </Link>
              <Link href="/terms" className={styles.footerLink}>
                Terms and Agreement
              </Link>
            </div>
          </div>
        </div>
      </section>
    </footer>
  );
};
