// app/services/page.tsx

import ServicesClient from "./ServicesClient";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Services", "Request moving, junk removal, furniture assembly, marketplace pickup, or donation pickup services.", "/services");

export default function ServicesPage() {
  return <ServicesClient />;
}
