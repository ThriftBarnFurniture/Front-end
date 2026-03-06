// app/services/page.tsx

import ServicesClient from "./ServicesClient";

export const metadata = {
  title: "Services | Thrift Barn",
  description:
    "Request moving, junk removal, furniture assembly, marketplace pickup, or donation pickup services.",
};

export default function ServicesPage() {
  return <ServicesClient />;
}
