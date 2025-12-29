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
      { days: 'Monday - Friday', time: 'Closed' },
      { days: 'Saturday', time: '12:00 PM - 5:00 PM' },
      { days: 'Sunday', time: '12:00 PM - 5:00 PM' },
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
            <p className={styles.heroSubtitle}>We have the solution!</p>

            <a className={styles.heroButton} href="https://www.facebook.com/groups/961935455087635/" target="_blank" rel="noopener noreferrer">
              Shop Our Massive Inventory
            </a>
          </div>
        </div>
      </section>

      {/* ===== ABOUT SECTION ===== */}
      <section id="about" className={styles.aboutSection}>
        <div className={styles.aboutPanel}>

          {/* NEW: 2-row layout like the screenshot */}
          <div className={styles.aboutLayout}>

            {/* TOP LEFT */}
            <div className={styles.aboutTopLeft}>
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
                toward a healthier planet. When Canadians think thrift, they think <br/>
                Thrift Barn Furniture!
              </p>
            </div>

            {/* TOP RIGHT (big circle) */}
            <div className={styles.aboutTopRight}>
              <div className={styles.aboutCircleBig}>
                <Image
                  src="/inside_barn_closed.jpg"
                  alt="Thrift Barn Furniture"
                  fill
                  priority
                  sizes="(max-width: 992px) 340px, 680px"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>

            {/* BOTTOM LEFT (two overlapping circles) */}
            <div className={styles.aboutBottomLeft}>
              <div className={styles.aboutCircleStack}>
                <div className={styles.aboutCircleSmall}>
                  <Image
                    src="/snowbarn.jpg"
                    alt="Furniture"
                    fill
                    sizes="(max-width: 992px) 340px, 680px"
                    style={{ objectFit: "cover" }}
                  />
                </div>

                <div className={styles.aboutCircleOverlap} />
                <div className={`${styles.aboutCircleSmall2}`}>
                  <Image
                    src="/furniture.jpg"
                    alt="Furniture detail"
                    fill
                    sizes="(max-width: 992px) 180px, 210px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              </div>
            </div>

            {/* BOTTOM RIGHT */}
            <div className={styles.aboutBottomRight}>
              <h3 className={styles.aboutTitle}>What We Do.</h3>
              <p className={styles.aboutText}>
                Aside from providing our community with quality, ethically sourced, pre-loved 
                furniture at a reasonable price, we provide services such as:
              </p>
              <ul className={styles.aboutList}>
                <li>Furniture Removal / Clear Out</li>
                <li>Moving Services</li>
                <li>Junk Removal Services</li>
                <li>Delivery & Distribution</li>
                <li>Assembly & Repairs</li>
              </ul>
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
            <h2 className={styles.contactTitle}>GET IN TOUCH.</h2>
            <p className={styles.contactBlurb}>
              Have questions? <br/>Reach out anytime — we’re happy to help.
            </p>

            <div className={styles.contactGrid}>
              {/* Phone */}
              <div className={styles.contactItem}>
                <Image src="/Icon-Cell.svg" alt="Phone" width={44} height={44} />
                <p className={styles.contactLabel}>Text or Call us - 24/7 - 365:</p>
                <a className={styles.contactLink} href="tel:{myStoreInfo.phone}">(613) 915-DUTY</a>
              </div>

              {/* Address */}
              <div className={styles.contactItem}>
                <Image src="/Icon-Barn.svg" alt="Address" width={80} height={80} />
                <p className={styles.contactLabel}>Address:</p>
                <p className={styles.contactValueSmall}>
                  {myStoreInfo.address}
                  <br />
                  {myStoreInfo.city}
                </p>
              </div>

              {/* Hours */}
              <div className={styles.contactItem}>
                <Image src="/Icon-Clock.svg" alt="Hours" width={75} height={75} />
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
                <Image src="/Icon-Email.svg" alt="Email" width={70} height={70} />
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
