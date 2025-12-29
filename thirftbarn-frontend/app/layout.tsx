import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar/navbar";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Footer } from "@/components/footer/footer";
import { Permanent_Marker, Montserrat } from "next/font/google";

const permanentMarker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-permanent-marker",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://thriftbarnfurniture.ca"),

  title: {
    default: "Thrift Barn Furniture | Affordable & Vintage Furniture in Canada",
    template: "%s | Thrift Barn Furniture",
  },

  description:
    "Thrift Barn Furniture is a Canadian marketplace for affordable, vintage, and quality second-hand furniture. Discover unique pieces and give furniture a second life.",

  applicationName: "Thrift Barn Furniture",

  keywords: [
    "thrift furniture",
    "second hand furniture",
    "vintage furniture",
    "used furniture Canada",
    "affordable furniture",
    "furniture marketplace",
    "Thrift Barn Furniture",
  ],

  authors: [{ name: "Thrift Barn Furniture" }],

  creator: "Thrift Barn Furniture",
  publisher: "Thrift Barn Furniture",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  alternates: {
    canonical: "https://thriftbarnfurniture.ca",
  },

  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://thriftbarnfurniture.ca",
    siteName: "Thrift Barn Furniture",
    title: "Thrift Barn Furniture | Affordable & Accessible Furniture Recycling in Canada",
    description:
      "Shop affordable, vintage, and second-hand furniture across Canada. Thrift Barn Furniture gives quality furniture a second life.",
    images: [
      {
        url: "/crest.jpg",
        width: 1200,
        height: 630,
        alt: "Thrift Barn Furniture",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Thrift Barn Furniture | Affordable & Vintage Furniture in Canada",
    description:
      "A Canadian marketplace for affordable, vintage, and second-hand furniture.",
    images: ["/og-image.svg"],
  },

  category: "Furniture",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${permanentMarker.variable} ${montserrat.variable}`}>
      <body className="flex min-h-full flex-col bg-white">
        <Navbar />
        <main className="flex-grow bg-white">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
