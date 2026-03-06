import Link from "next/link";
import styles from "@/app/page.module.css";
import { createClient } from "@/utils/supabase/server";
import Reveal from "../ui/Reveal";

type DayBucket = {
  day: number;      // 1..7
  price: number;    // 40..10
  count: number;    // how many items in that day
};

async function getBarnBurnerDayCounts(): Promise<Record<number, number>> {
  const supabase = await createClient();

  // Pull day values for active barn-burner items and count in JS
  const { data, error } = await supabase
    .from("products")
    .select("barn_burner_day")
    .contains("category", ["barn-burner"])
    .eq("is_active", true)
    .gt("quantity", 0);

  if (error) {
    console.error("getBarnBurnerDayCounts error:", error.message);
    return {};
  }

  const counts: Record<number, number> = {};
  for (const row of data ?? []) {
    const d = typeof row.barn_burner_day === "number" ? row.barn_burner_day : 1;
    if (d >= 1 && d <= 7) counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
}

function priceForDay(day: number) {
  // Day1=40, Day2=35 ... Day7=10
  return Math.max(10, 40 - 5 * (day - 1));
}

export default async function BarnBurnerSection() {
  const counts = await getBarnBurnerDayCounts();

  const days: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    return { day, price: priceForDay(day), count: counts[day] ?? 0 };
  });

  return (
    <section className={styles.barnBurnerSection} aria-label="Barn Burner liquidation">
      <div className={styles.sectionInner}>
        <div className={styles.barnBurnerHeader}>
          <Reveal>
            <h2 className={styles.barnBurnerTitle}>🔥 BARN BURNER 🔥</h2>
          </Reveal>

          <Reveal delayMs={80}>
            <p className={styles.barnBurnerExplain}>
              Items start at <strong>$40</strong> and drop <strong>$5 every day</strong>! <br/>
              Grab it while it's still hot!
            </p>
          </Reveal>
        </div>

        <div className={styles.barnBurnerDayGrid}>
          {days.map((d, i) => (
            <Reveal key={d.day} delayMs={160 + i * 70}>
              <Link
                href={`/shop?category=barn-burner&subcategory=day-${d.day}`}
                className={`${styles.barnBurnerDayCard} popHover`}
                aria-label={`Shop Barn Burner Day ${d.day}`}
              >
                <div className={styles.barnBurnerDayLabel}>🔥DAY {d.day}🔥</div>
                <div className={styles.barnBurnerDayPrice}>${d.price.toFixed(2)}</div>
                <div className={styles.barnBurnerDayCountLine}>
                  <span className={styles.barnBurnerDayCount}>{d.count}</span>
                  <span className={styles.barnBurnerDayCountLabel}>items</span>
                </div>
                <div className={styles.barnBurnerDayCta}>➜</div>
              </Link>
            </Reveal>
          ))}
        </div>


        <Reveal delayMs={80}>
          <p className={styles.barnBurnerSubtext}>
            All unsold products can be found in our <a href="/shop?collection=5-under">5$ and Under</a> section after Day 7.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
