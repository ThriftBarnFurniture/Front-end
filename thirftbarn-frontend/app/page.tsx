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
      <section id="hero" className={styles.hero}>
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

      {/* ===== ABOUT SECTION ===== */}
      <section id="about" className={styles.aboutSection}>
        <div className={styles.aboutPanel}>
          <div className={styles.aboutGrid}>
            {/* Left text block */}
            <div className={styles.aboutLeft}>
              <div className={styles.aboutIcon}>
                <Image src="/Icon-Leaf.svg" alt="Maple" width={40} height={40} />
              </div>

              <h2 className={styles.aboutTitle}>
                DISCOVER TREASURES IN <br /> EVERY CORNER.
              </h2>

              <p className={styles.aboutText}>
                At Thrift Barn Furniture, we envision a Canada where sustainable living and
                community building go hand-in-hand. By championing the recirculation of quality
                used furniture, we see a future where Canadian owned businesses pave the path
                toward a healthier planet. When Canadians think of thrift, they will think of
                Thrift Barn Furniture!
              </p>
            </div>

            {/* Right large photo circle */}
            <div className={styles.aboutRight}>
              <div className={styles.bigCircle}>
                <div className={styles.heroImage}>
                  <Image
                    src="/TBF_WideLogo.svg"
                    alt="Thrift Barn Furniture"
                    width={500}        // intrinsic width
                    height={160}       // intrinsic height
                    sizes="(max-width: 768px) 200px, 300px"
                    style={{
                      width: "100%",
                      height: "auto",
                    }}
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RED DIVIDER LINE ===== */}
      <div className={styles.redDivider} />

      {/* ===== CONTACT (INFO + MAP) ===== */}
      <section id="contact" className={styles.contactSection}>
        <div className={styles.contactPanel}>
          {/* Top “Get in touch” block */}
          <div className={styles.contactTop}>
            <h2 className={styles.contactTitle}>GET IN TOUCH</h2>
            <p className={styles.contactBlurb}>
              Have a question about inventory, deliveries, or store hours? Reach out anytime — we’re happy to help.
            </p>

            <div className={styles.contactGrid}>
              {/* Phone */}
              <div className={styles.contactItem}>
                <Image src="/Icon-Cell.svg" alt="Phone" width={44} height={44} />
                <p className={styles.contactLabel}>Text or Call us - 24/7 - 365:</p>
                <p className={styles.contactValue}>{myStoreInfo.phone}</p>
              </div>

              {/* Address */}
              <div className={styles.contactItem}>
                <Image src="/Icon-Barn.svg" alt="Address" width={48} height={48} />
                <p className={styles.contactLabel}>Address:</p>
                <p className={styles.contactValueSmall}>
                  {myStoreInfo.address}
                  <br />
                  {myStoreInfo.city}
                </p>
              </div>

              {/* Hours */}
              <div className={styles.contactItem}>
                <Image src="/Icon-Clock.svg" alt="Hours" width={48} height={48} />
                <p className={styles.contactLabel}>In-Store Hours:</p>
                <div className={styles.hoursList}>
                  {myStoreInfo.hours.map((h) => (
                    <p key={h.days} className={styles.contactValueSmall}>
                      <span className={styles.hoursDays}>{h.days}:</span> {h.time}
                    </p>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div className={styles.contactItem}>
                <Image src="/Icon-Email.svg" alt="Email" width={48} height={48} />
                <p className={styles.contactLabel}>Email:</p>
                <a className={styles.contactLink} href={`mailto:${myStoreInfo.email}`}>
                  {myStoreInfo.email}
                </a>
              </div>
            </div>
          </div>

          {/* ===== RED DIVIDER LINE ===== */}
          <div className={styles.redDivider} />

          {/* Map (your existing implementation) */}
          <div className={styles.contactMapWrap}>
            <StoreLocationSection storeInfo={myStoreInfo} logoUrl="/Icon-MapPin.svg" />
          </div>
        </div>
      </section>

      {/* ===== RED DIVIDER LINE ===== */}
      <div className={styles.redDivider} />

    </main>
  );
}
