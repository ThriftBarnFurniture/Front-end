import Image from "next/image";
import Link from "next/link";
import styles from "@/app/page.module.css";
import { createClient } from "@/utils/supabase/server";
import Reveal from "../ui/Reveal";


type BarnBurnerProduct = {
  id: string;
  name: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  created_at: string | null; // used to determine which “cycle” it’s in
};

type ViewModel = BarnBurnerProduct & {
  todayPrice: number;
};

function getTodayLabel(d: Date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
}

// Saturday: $40, drop $5/day, next Saturday: $5, next Sunday+: $2 forever
function barnBurnerPriceForDayOffset(dayOffset: number) {
  const schedule = [40, 35, 30, 25, 20, 15, 10, 5]; // 0..7 (Sat..next Sat)
  if (dayOffset <= 7) return schedule[Math.max(0, dayOffset)];
  return 2;
}

// Returns how many days have passed since the “entry Saturday” for that item
function getDaysSinceEntrySaturday(entryISO: string, now: Date) {
  const entry = new Date(entryISO);

  // Find the Saturday at the start of the entry week
  const entryDay = entry.getDay(); // 0 Sun .. 6 Sat
  const daysBackToSat = (entryDay + 1) % 7; // Sat->0, Sun->1, Mon->2, ...
  const entrySaturday = new Date(entry);
  entrySaturday.setHours(0, 0, 0, 0);
  entrySaturday.setDate(entrySaturday.getDate() - daysBackToSat);

  const nowStart = new Date(now);
  nowStart.setHours(0, 0, 0, 0);

  const diffMs = nowStart.getTime() - entrySaturday.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function getBarnBurnerProducts(limit = 10): Promise<BarnBurnerProduct[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id,name,image_url,image_urls,created_at")
    .eq("category", "barn-burner") // change if your tag differs
    .eq("is_active", true)
    .gt("quantity", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getBarnBurnerProducts error:", error.message);
    return [];
  }

  return (data ?? []) as BarnBurnerProduct[];
}

export default async function BarnBurnerSection() {
  // ✅ ensures it updates daily (no static build-time caching)
  // You can also use: export const revalidate = 86400; in the page instead.
  const now = new Date();
  const todayLabel = getTodayLabel(now);

  const products = await getBarnBurnerProducts(10);

  const vm: ViewModel[] = products.map((p) => {
    const dayOffset = p.created_at ? getDaysSinceEntrySaturday(p.created_at, now) : 0;
    return {
      ...p,
      todayPrice: barnBurnerPriceForDayOffset(dayOffset),
    };
  });

  // For the header “today price”, use the *current week’s* day offset (Sat-based)
  const todayOffset = [1, 2, 3, 4, 5, 6, 0][now.getDay()]; // Sun..Sat => 1..6,0
  const todayGlobalPrice = barnBurnerPriceForDayOffset(todayOffset);

  return (
    <section className={styles.barnBurnerSection} aria-label="Barn Burner liquidation">
      <div className={styles.sectionInner}>
        <div className={styles.barnBurnerHeader}>
            <Reveal>
            <h2 className={styles.barnBurnerTitle}>🔥 BARN BURNER 🔥</h2>
            </Reveal>
        
            <Reveal delayMs={80}>
            <p className={styles.barnBurnerExplain}>
            Items enter every Saturday at <strong>$40</strong> and drop <strong>$5 each day</strong>!
            </p>
            <p className={styles.barnBurnerToday}>
            Today is <strong>{todayLabel}</strong> — The Barn Burner price is{" "}
            <strong>${todayGlobalPrice.toFixed(2)}</strong>.
            </p>
            </Reveal>
        </div>
        <Reveal delayMs={160}>
        <div className={styles.productRow}>
          {vm.map((p) => {
            const img =
              p.image_url ||
              (Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls[0] : null) ||
              "/furniture.jpg";

            return (
              <Link key={p.id} href={`/item/${p.id}`} className={styles.productCardLink}>
                <article className={`${styles.productCard} ${styles.barnBurnerCard} popHover`}>
                  <div className={styles.productImgWrap} aria-hidden="true">
                    <Image
                      src={img}
                      alt=""
                      fill
                      sizes="(max-width: 480px) 92vw, (max-width: 768px) 45vw, (max-width: 1200px) 22vw, 210px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>

                  <div className={styles.productMeta}>
                    <p className={styles.productName}>{p.name ?? "Untitled"}</p>
                    <p className={styles.productPrice}>${p.todayPrice.toFixed(2)}</p>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
        </Reveal>

        <Reveal delayMs={240}>
        <div className={styles.barnBurnerCtaWrap}>
            <Link href="/shop?category=barn-burner" className={`${styles.viewAllBtn} popHover`}>
            Shop Barn Burner
            </Link>
        </div>
        </Reveal>
      </div>
    </section>
  );
}
