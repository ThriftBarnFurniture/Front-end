import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
