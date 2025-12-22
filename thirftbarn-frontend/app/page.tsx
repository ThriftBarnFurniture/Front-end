import Image from "next/image";
import styles from "./page.module.css";
import StoreLocationSection from '@/components/map/storeLocationSection';


export default function Home() {
    const myStoreInfo = {
    name: 'Thrift Barn Furniture',
    address: '2786 ON-34',
    city: 'Hawkesbury, ON K6A 2R2',
    phone: '(613) 915-3889',
    email: 'thriftbarnfurniture@gmail.com',
    hours: [
      { days: 'Monday - Friday', time: '9:00 AM - 7:00 PM' },
      { days: 'Saturday', time: '10:00 AM - 6:00 PM' },
      { days: 'Sunday', time: 'Closed' },
    ],
    coordinates: {
      lat: 45.57579587217674, 
      lng:-74.62376273510597,
    },
  };
  return (
    <main className={styles.page}>
      {/* ===== HERO ===== */}
      <section className={styles.hero}>
        {/* Background image */}
        <Image
          src="/Hero-bg.jpg"
          alt="Thrift Barn Furniture showroom"
          fill
          priority
          className={styles.heroBg}
        />

        {/* Dark overlay */}
        <div className={styles.heroOverlay} />

        {/* Hero content */}
        <div className={styles.heroInner}>
          <div className={styles.heroLogoWrap}>
            <Image
              src="/TBF_Crest-OnDark.svg"
              alt="Thrift Barn Furniture Logo"
              width={240}
              height={240}
              className={styles.heroLogo}
            />
          </div>

          <div className={styles.heroCtaBox}>
            <h1 className={styles.heroTitle}>FURNITURE PROBLEMS?</h1>
            <p className={styles.heroSubtitle}>We have the solution.</p>

            <a className={styles.heroButton} href="#visit">
              Visit the Barn today!
            </a>
          </div>
        </div>
      </section>

      {/* ===== DISCOVER SECTION ===== */}
      <section className={styles.discover}>
        <div className={styles.discoverInner}>
          <div className={styles.discoverGrid}>
            {/* Left text block */}
            <div className={styles.discoverLeft}>
              <div className={styles.discoverIcon}>
                <Image src="/Icon-Leaf.svg" alt="Maple" width={40} height={40} />
              </div>

              <h2 className={styles.discoverTitle}>
                DISCOVER TREASURES IN <br /> EVERY CORNER.
              </h2>

              <p className={styles.discoverText}>
                In hac habitasse platea dictumst. Praesent a erat gravida, lobortis dui at,
                gravida nisi. Class aptent taciti sociosqu ad litora torquent per conubia
                nostra, per inceptos himenaeos. Nullam molestie ornare nisi, nec iaculis
                mi congue eu.
              </p>
            </div>

            {/* Right large photo circle */}
            <div className={styles.discoverRight}>
              <div className={styles.bigCircle}>PHOTO</div>
            </div>

            {/* Bottom-left circles */}
            <div className={styles.discoverBottomLeft}>
              <div className={styles.midCircle}>PHOTO</div>
              <div className={styles.smallCircle}>PHOTO</div>
            </div>

            {/* Bottom-right text block */}
            <div className={styles.discoverBottomRight}>
              <h3 className={styles.loremTitle}>Lorem Ipsum</h3>
              <p className={styles.loremText}>
                In hac habitasse platea dictumst. Praesent a erat gravida, lobortis dui at,
                gravida nisi. Class aptent taciti sociosqu ad litora torquent per conubia
                nostra, per inceptos himenaeos. Nullam molestie ornare nisi, nec iaculis
                mi congue eu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RED DIVIDER LINE ===== */}
      <div className={styles.redDivider} />

      {/* ===== MAP (INTERACTIVE CUSTOM PIN) ===== */}
      <section className={styles.mapSection}>
        <StoreLocationSection 
        storeInfo={myStoreInfo}
        logoUrl="/Icon-MapPin.svg"
      />
      </section>
    </main>
  );
}
