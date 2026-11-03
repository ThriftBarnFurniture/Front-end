import type { Metadata } from "next";

export const SITE_URL = "https://www.thriftbarnfurniture.ca";
export const privatePageMetadata: Metadata = { robots: { index: false, follow: false } };

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: { title, description, url: `${SITE_URL}${path}`, siteName: "Thrift Barn Furniture", type: "website", locale: "en_CA", images: [{ url: "/crest.jpg", alt: "Thrift Barn Furniture" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/crest.jpg"] },
  };
}
