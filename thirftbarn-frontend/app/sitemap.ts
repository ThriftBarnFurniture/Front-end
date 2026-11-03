import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const entries: MetadataRoute.Sitemap = ["/", "/shop", "/services", "/privacy", "/terms"].map(path => ({ url: `${SITE_URL}${path}` }));
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("products").select("id,updated_at")
      .eq("is_active", true).order("id").range(offset, offset + 499);
    if (error) throw new Error("Unable to load sitemap products.");
    for (const product of data ?? []) entries.push({ url: `${SITE_URL}/item/${product.id}`, ...(product.updated_at ? { lastModified: product.updated_at } : {}) });
    if (!data || data.length < 500) break;
  }
  return entries;
}
