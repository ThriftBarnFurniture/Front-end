import Image from "next/image";
import styles from "./page.module.css";
import StoreLocationSection from '@/components/map/storeLocationSection';
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import NewToBarnCarousel from "@/components/home/NewToBarnCarousel";
import BarnBurnerSection from "@/components/home/BarnBurnerSection";
import Reveal from "@/components/ui/Reveal";


type NewProduct = {
  id: string;
  name: string | null;
  price: number | null;
  initial_price: number | null;
  image_url: string | null;
  image_urls: string[] | null;
  created_at: string | null;
};

async function getNewestProducts(limit = 5): Promise<NewProduct[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,initial_price,image_url,image_urls,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getNewestProducts error:", error.message);
    return [];
  }

  return (data ?? []) as NewProduct[];
}

export default async function Home() {
  const newestProducts = await getNewestProducts(15);

  const myStoreInfo = {
    name: 'Thrift Barn Furniture',
    address: '2786 ON-34',
    city: 'Hawkesbury, ON K6A 2R2',
    phone: '(613) 915-3889',
    email: 'thriftbarnfurniture@gmail.com',
    hours: [
      { days: 'Mon - Thu', time: 'By Appointment' },
      { days: 'Fri - Sun', time: '10:00 AM - 5:00 PM' },
    ],
    serviceHours: [
      { days: '24/7', time: 'By Appointment' },
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
            <Reveal delayMs={80}>
              <h1 className={styles.heroTitle}>FURNITURE PROBLEMS?</h1>
            </Reveal>

            <Reveal delayMs={140}>
              <p className={styles.heroSubtitle}>We have the solution!</p>
            </Reveal>

            <Reveal delayMs={200}>
              <a className={`${styles.heroButton} popHover`} href="/shop" rel="noopener noreferrer">
                Shop Our Massive Inventory
              </a>
            </Reveal>
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

              <Reveal>
                <h2 className={styles.aboutTitle}>
                  DISCOVER TREASURES IN <br /> EVERY CORNER.
                </h2>
              </Reveal>
              <Reveal delayMs={80}>
                <p className={styles.aboutText}>
                  At Thrift Barn Furniture, we envision a Canada where sustainable living and
                  community building go hand-in-hand. By championing the recirculation of quality
                  used furniture, we see a future where Canadian owned businesses pave the path
                  toward a healthier planet. When Canadians think thrift, they think <br/>
                  Thrift Barn Furniture!
                </p>
              </Reveal>
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
              <Reveal>
                <h3 className={styles.aboutTitle}>What We Do.</h3>
              </Reveal>

              <Reveal delayMs={80}>
                <p className={styles.aboutText}>
                  Aside from providing our community with quality, ethically sourced, pre-loved 
                  furniture at a reasonable price, we provide services such as:
                </p>
              </Reveal>
                <ul className={styles.aboutList}>
                  <Reveal delayMs={80}>
                  <li>Furniture Removal / Clear Outs</li>
                  </Reveal>
                  <Reveal delayMs={160}>
                  <li>Moving Services</li>
                  </Reveal>
                  <Reveal delayMs={240}>
                  <li>Junk Removal Services</li>
                  </Reveal>
                  <Reveal delayMs={320}>
                  <li>Delivery & Distribution</li>
                  </Reveal>
                  <Reveal delayMs={400}>
                  <li>Assembly & Repairs</li>
                  </Reveal>
                </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ===== BARN BURNER (LIQUIDATION) ===== */}
      <BarnBurnerSection />

      {/* ===== SHOP BY CATEGORY ===== */}
      <section className={styles.shopByRoomSection} aria-label="Shop by Category">
        <div className={styles.sectionInner}>
          <Reveal>
            <h2 className={styles.altSectionHeading}>SHOP BY CATEGORY.</h2>
          </Reveal>
          <Reveal delayMs={80}>
          <div className={styles.roomGrid}>
            {[
              { label: "$5 and Under", img: "/category/Image-5under.png", href: "/shop?collection=5-under" },
              { label: "Kitchen", img: "/category/Image-Kitchen.png", href: "/shop?room=kitchen" },
              { label: "Living Room", img: "/category/Image-LivingRoom.png", href: "/shop?room=living-room" },
              { label: "Home Decor", img: "/category/Image-HomeDecor.png", href: "/shop?room=home-decor" },
              { label: "Dining Room", img: "/category/Image-DiningRoom.png", href: "/shop?room=dining-room" },
              { label: "Bedroom", img: "/category/Image-Bedroom.png", href: "/shop?room=bedroom" },
              { label: "Storage Furniture", img: "/category/Image-StorageFurniture.png", href: "/shop?category=storage-furniture" },
              { label: "Seasonal", img: "/category/Image-Seasonal.png", href: "/shop?collection=seasonal" },
            ].map((c) => (
              <Link key={c.label} href={c.href} className={styles.roomItemLink}>
                <div className={`${styles.roomItem} popHover`}>
                  <div className={styles.roomCircle}>
                    <Image
                      src={c.img}
                      alt={c.label}
                      fill
                      sizes="(max-width: 480px) 240px, (max-width: 768px) 220px, 250px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <p className={styles.roomLabel}>{c.label}</p>
                </div>
              </Link>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      {/* ===== RED DIVIDER LINE ===== */}
      <div className={styles.redDivider} />

      {/* ===== NEW TO THE BARN ===== */}
      <section className={styles.newToBarnSection} aria-label="New to the Barn">
        <div className={styles.sectionInner}>
          <Reveal>
          <h2 className={styles.sectionHeading}>NEW TO THE BARN.</h2>
          </Reveal>

          {/* ✅ Carousel */}
          <Reveal delayMs={80}>
          <NewToBarnCarousel products={newestProducts} />
          </Reveal>

          {/* ✅ Button under carousel */}
          <Reveal delayMs={160}>
          <div className={styles.newToBarnCtaWrap}>
            <Link href="/shop" className={`${styles.viewAllBtn} popHover`}>
              View all products
            </Link>
          </div>
          </Reveal>
        </div>
      </section>


      {/* ===== CONTACT (INFO + MAP) ===== */}
      <section id="contact" className={styles.contactSection}>
        <div className={styles.contactPanel}>
          {/* Top “Get in touch” block */}
          <div className={styles.contactTop}>
            <Reveal>
            <h2 className={styles.contactTitle}>GET IN TOUCH.</h2>
            </Reveal>
            <Reveal delayMs={80}>
            <p className={styles.contactBlurb}>
              Have questions? <br/>Reach out anytime — we’re happy to help.
            </p>
            </Reveal>
            
            <div className={styles.contactGrid}>
              {/* Phone */}
              <Reveal delayMs={160}>
              <div className={styles.contactItem}>
                <Image className={styles.phoneContact} src="/Icon-Cell.svg" alt="Phone" width={44} height={44} />
                <p className={styles.contactLabel}>Text or Call - 24/7 - 365:</p>
                <a className={`${styles.contactLink} popHover`} href='tel:${myStoreInfo.phone}'>613-915-3889 (DUTY)</a>
              </div>
              </Reveal>

              {/* Address */}
              <Reveal delayMs={240}>
              <div className={styles.contactItem}>
                <Image src="/Icon-Barn.svg" alt="Address" width={80} height={80} />
                <p className={styles.contactLabel}>Address:</p>
                <a className={`${styles.contactLink} popHover`} target="_blank" href='https://www.google.com/maps/place/Thrift+Barn+Furniture/@45.5758123,-74.6263256,17z/data=!3m1!4b1!4m6!3m5!1s0x4ccee9b61260671d:0x75af7e8cb624092!8m2!3d45.5758123!4d-74.6237453!16s%2Fg%2F11ydl3kphn?entry=ttu&g_ep=EgoyMDI2MDEyMS4wIKXMDSoASAFQAw%3D%3D'>
                  {myStoreInfo.address}
                  <br />
                  {myStoreInfo.city}
                </a>
              </div>
              </Reveal>

              {/* Hours */}
              <Reveal delayMs={320}>
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
              </Reveal>

              {/* Hours */}
              <Reveal delayMs={400}>
              <div className={styles.contactItem}>
                <Image src="/Icon-Services.png" alt="Hours" width={85} height={85} />
                <p className={styles.serviceContactLabel}>Service Hours:</p>
                <div className={styles.serviceHoursList}>
                  {myStoreInfo.serviceHours.map((h) => (
                    <p key={h.days} className={styles.contactValueSmall}>
                      <span className={styles.hoursDays}>{h.days}:</span> {h.time}
                    </p>
                  ))}
                </div>
              </div>
              </Reveal>

              {/* Email */}
              <Reveal delayMs={480}>
              <div className={styles.contactItem}>
                <Image src="/Icon-Email.svg" alt="Email" width={70} height={70} />
                <p className={styles.contactLabel}>Email:</p>
                <a className={`${styles.contactLink} popHover`} href={`mailto:${myStoreInfo.email}`}>
                  {myStoreInfo.email}
                </a>
              </div>
              </Reveal>
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
