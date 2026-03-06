"use client";

import Image from "next/image";
import styles from "./item.module.css";
import { useMemo, useState } from "react";

export default function ImageGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const clean = useMemo(() => images.filter(Boolean), [images]);
  const [active, setActive] = useState(0);

  if (clean.length === 0) {
    return <div className={styles.noImage}>No image</div>;
  }

  const main = clean[Math.min(active, clean.length - 1)];

  return (
    <div className={styles.gallery}>
      <div className={styles.mainImageWrap}>
        <Image
          src={main}
          alt={alt}
          fill
          className={styles.mainImage}
          sizes="(max-width: 900px) 100vw, 50vw"
          priority
        />
      </div>

      {clean.length > 1 && (
        <div className={styles.thumbs}>
          {clean.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              className={`${styles.thumbBtn} ${i === active ? styles.thumbActive : ""}`}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
            >
              <div className={styles.thumbImgWrap}>
                <Image
                  src={src}
                  alt={`${alt} thumbnail ${i + 1}`}
                  fill
                  className={styles.thumbImg}
                  sizes="120px"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
