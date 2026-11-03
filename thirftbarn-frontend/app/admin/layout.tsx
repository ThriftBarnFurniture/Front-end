import { requireAdmin } from "@/lib/require-admin";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // redirects to /login or /
  return <>{children}</>;
}
