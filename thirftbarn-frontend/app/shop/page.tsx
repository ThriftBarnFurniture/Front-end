import Link from "next/link";
import styles from "./shop.module.css";
import Image from "next/image";

export default function ShopPage() {
  return (
    <main className={styles.page}>
      <section className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.construction}>
            <span className={styles.hammer}>🔨</span>
          </div>
          <div className={styles.badge}>UNDER CONSTRUCTION</div>
          <p className={styles.subtitle}>
            We’re working diligently to get the online store running for you. <br/>
            In the meantime, you can browse all of our products on Facebook.
          </p>

          <div className={styles.actions}>
            
            <a
              className={styles.primary}
              href="https://www.facebook.com/groups/961935455087635/"
              target="_blank"
              rel="noreferrer"
            >
              <Image src="./facebook-circle-fill.svg" alt="Facebook Logo" width={24} height={24} className={styles.icon}/>
            </a>

            <Link className={styles.secondary} href="/#contact">
              Contact Us
            </Link>
          </div>

          <p className={styles.note}>
            Thank you for your patience
          </p>
        </div>
      </section>
    </main>
  );
}
