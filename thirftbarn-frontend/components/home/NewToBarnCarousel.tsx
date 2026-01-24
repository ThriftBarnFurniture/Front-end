"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./newToBarnCarousel.module.css";

type NewProduct = {
  id: string;
  name: string | null;
  price: number | null;
  image_url: string | null;
  image_urls: string[] | null;
  created_at: string | null;
};

export default function NewToBarnCarousel({
  products,
  intervalMs = 2600,
}: {
  products: NewProduct[];
  intervalMs?: number;
}) {
  const clean = useMemo(() => (products ?? []).slice(0, 15), [products]);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [paused, setPaused] = useState(false);

  // --- drag state (no rerenders while dragging)
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const draggingRef = useRef(false);

  // Auto-scroll “carousel” effect
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const tick = () => {
      const first = el.querySelector<HTMLElement>("[data-card]");
      if (!first) return;

      const cardW = first.offsetWidth;
      const gap = 22; // keep in sync with CSS gap
      const step = cardW + gap;

      const maxScroll = el.scrollWidth - el.clientWidth;

      if (el.scrollLeft >= maxScroll - 2) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollTo({ left: Math.min(el.scrollLeft + step, maxScroll), behavior: "smooth" });
      }
    };

    if (paused || clean.length <= 1) return;

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, intervalMs, clean.length]);

  // --- drag handlers
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;

    isDownRef.current = true;
    draggingRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    startScrollLeftRef.current = el.scrollLeft;

    setPaused(true); // pause auto-scroll while dragging
    el.classList.add(styles.dragActive);
  };

  const onMouseLeave = () => {
    const el = trackRef.current;
    if (!el) return;

    isDownRef.current = false;
    el.classList.remove(styles.dragActive);

    // only unpause if not hovering (mouseleave means you're not)
    setPaused(false);
  };

  const onMouseUp = () => {
    const el = trackRef.current;
    if (!el) return;

    isDownRef.current = false;
    el.classList.remove(styles.dragActive);

    // keep paused if still hovering; your wrap hover handles it
    // (but mouseup alone shouldn't unpause automatically)
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    if (!isDownRef.current) return;

    e.preventDefault();

    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.4; // drag speed multiplier
    const next = startScrollLeftRef.current - walk;

    if (!draggingRef.current && Math.abs(x - startXRef.current) > 6) {
      draggingRef.current = true;
    }

    el.scrollLeft = next;
  };

  if (clean.length === 0) {
    return <div className={styles.empty}>No new items yet.</div>;
  }

  return (
    <div
      className={styles.wrap}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={styles.track}
        ref={trackRef}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
      >
        {clean.map((p) => {
          const img =
            p.image_url ||
            (Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls[0] : null) ||
            "/furniture.jpg";

          const priceText = typeof p.price === "number" ? `$${p.price.toFixed(2)}` : "";

          return (
            <Link
              key={p.id}
              href={`/item/${p.id}`}
              className={styles.cardLink}
              draggable={false}
              onClick={(e) => {
                // If it was a drag, prevent accidental navigation
                if (draggingRef.current) e.preventDefault();
              }}
            >
              <article className={styles.card} data-card draggable={false}>
                <div className={`${styles.imgWrap} popHover`} aria-hidden="true" draggable={false}>
                  <Image
                    src={img}
                    alt=""
                    fill
                    draggable={false}
                    sizes="(max-width: 480px) 85vw, (max-width: 768px) 55vw, 260px"
                    style={{ objectFit: "cover" }}
                  />
                </div>

                <div className={styles.meta}>
                  <p className={styles.name}>{p.name ?? "Untitled"}</p>
                  <p className={styles.price}>{priceText}</p>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
