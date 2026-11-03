import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Utility pages carry noindex metadata. Allow crawling those pages so bots
  // can see that directive; only API endpoints are disallowed here.
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${SITE_URL}/sitemap.xml` };
}
