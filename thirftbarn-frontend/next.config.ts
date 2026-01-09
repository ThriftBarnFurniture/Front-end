import type { NextConfig } from "next";

const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

if (!r2PublicUrl) {
  throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL is not defined");
}

const r2Hostname = new URL(r2PublicUrl).hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: r2Hostname,
      },
    ],
  },
};

export default nextConfig;
