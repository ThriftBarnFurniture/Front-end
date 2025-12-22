import Image from "next/image";
import Link from "next/link";
import styles from "./footer.module.css";

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <section className={styles.bottomBar}>
        <div className={styles.bottomInner}>
            {/* LEFT */}
            <div className={styles.bottomLeft}>
            <Image
                src="/TBF_WideLogo.svg"
                alt="Thrift Barn Furniture"
                width={230}
                height={70}
                className={styles.brandLogo}
            />
            <div className={styles.copyright}>
                © Thrift Barn Furniture, {new Date().getFullYear()}
            </div>
            </div>

            {/* ROW 1 */}
            <div className={styles.followTitle}>Follow us</div>

            {/* ROW 2 */}
            <div className={styles.followUnderline} />

            {/* ROW 3 */}
            <div className={styles.bottomMid}>
            <span className={styles.fbIcon}>f</span>
            <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className={styles.followLink}
            >
                Find us on Facebook
            </a>
            </div>

            <div className={styles.bottomRight}>
            <Link href="/privacy-policy" className={styles.bottomLink}>
                Privacy Policy
            </Link>
            <Link href="/terms" className={styles.bottomLink}>
                Terms + Conditions
            </Link>
            </div>
        </div>
        </section>
    </footer>
  );
}
