import Image from "next/image";
import Link from "next/link";
import styles from "@/app/page.module.css";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isOutOfStock } from "@/lib/inventory";
import {
  estateSaleShopHref,
  formatEstateSaleName,
  getEstateSalePhotoUrl,
  getEstateSaleSlug,
  isEstateSaleCollection,
} from "@/lib/estate-sales";
import Reveal from "../ui/Reveal";

type EstateProductRow = {
  id: string;
  name: string | null;
  price: number | string | null;
  image_url: string | null;
  image_urls: string[] | null;
  created_at: string | null;
  collections: string[] | null;
  quantity: number | null;
};

type EstateSaleGroup = {
  collection: string;
  name: string;
  href: string;
  count: number;
  estatePhotoUrl: string | null;
  newestProduct: EstateProductRow;
  newestAt: number;
};

function getPrimaryImage(product: Pick<EstateProductRow, "image_urls" | "image_url">) {
  if (product.image_urls && product.image_urls.length > 0) return product.image_urls[0];
  return product.image_url;
}

async function getEstateSaleGroups(): Promise<EstateSaleGroup[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,image_url,image_urls,created_at,collections,quantity")
    .eq("is_active", true)
    .not("collections", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("getEstateSaleGroups error:", error.message);
    return [];
  }

  const groups = new Map<string, EstateSaleGroup>();

  for (const product of (data ?? []) as EstateProductRow[]) {
    if (isOutOfStock(product.quantity)) continue;

    const estateCollections = (product.collections ?? []).filter(isEstateSaleCollection);
    if (estateCollections.length === 0) continue;

    const createdAt = product.created_at ? new Date(product.created_at).getTime() : 0;

    for (const collection of estateCollections) {
      const existing = groups.get(collection);

      if (!existing) {
        groups.set(collection, {
          collection,
          name: formatEstateSaleName(collection),
          href: estateSaleShopHref(collection),
          count: 1,
          estatePhotoUrl: getEstateSalePhotoUrl(product.collections ?? [], collection),
          newestProduct: product,
          newestAt: createdAt,
        });
        continue;
      }

      existing.count += 1;
      if (!existing.estatePhotoUrl) {
        existing.estatePhotoUrl = getEstateSalePhotoUrl(product.collections ?? [], collection);
      }
      if (createdAt > existing.newestAt) {
        existing.newestAt = createdAt;
        existing.newestProduct = product;
      }
    }
  }

  const groupedEstateSales = Array.from(groups.values());
  const slugs = groupedEstateSales.map((group) => getEstateSaleSlug(group.collection)).filter(Boolean);

  if (slugs.length > 0) {
    try {
      const supabaseAdmin = createSupabaseAdmin();
      const { data: metadata, error: metadataError } = await supabaseAdmin
        .from("estate_sales")
        .select("slug,photo_url")
        .in("slug", slugs);

      if (metadataError) {
        console.error("getEstateSaleGroups metadata error:", metadataError.message);
      } else {
        const photoBySlug = new Map((metadata ?? []).map((row) => [row.slug, row.photo_url as string | null]));
        for (const group of groupedEstateSales) {
          group.estatePhotoUrl = photoBySlug.get(getEstateSaleSlug(group.collection)) ?? group.estatePhotoUrl;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown estate sale metadata error";
      console.error("getEstateSaleGroups metadata error:", message);
    }
  }

  return groupedEstateSales.sort((a, b) => b.newestAt - a.newestAt);
}

export default async function EstateSaleSection() {
  const estateSales = await getEstateSaleGroups();
  if (estateSales.length === 0) return null;

  return (
    <section className={styles.estateSaleSection} aria-label="Estate sales">
      <div className={styles.sectionInner}>
        <div className={styles.estateSaleHeader}>
          <Reveal>
            <h2 className={styles.estateSaleTitle}>ESTATE SALES.</h2>
          </Reveal>
          <Reveal delayMs={80}>
            <p className={styles.estateSaleIntro}>
              Limited-time estate collections.
            </p>
          </Reveal>
        </div>

        <div className={styles.estateSaleGrid}>
          {estateSales.map((sale, index) => (
            <Reveal key={sale.collection} delayMs={140 + index * 90}>
              <Link href={sale.href} className={styles.estateSalePhotoCard}>
                <div className={`${styles.estateSalePhotoWrap} popHover`}>
                  <Image
                    src={sale.estatePhotoUrl ?? getPrimaryImage(sale.newestProduct) ?? "/furniture.jpg"}
                    alt={sale.name}
                    fill
                    sizes="(max-width: 480px) 85vw, (max-width: 768px) 45vw, 320px"
                    style={{ objectFit: "cover" }}
                  />
                  <span className={styles.estateSalePhotoBadge}>
                    {sale.count} item{sale.count === 1 ? "" : "s"}
                  </span>
                </div>

                <div className={styles.estateSalePhotoMeta}>
                  <h3 className={styles.estateSaleName}>{sale.name}</h3>
                  <span className={styles.estateSaleCta}>View estate</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
