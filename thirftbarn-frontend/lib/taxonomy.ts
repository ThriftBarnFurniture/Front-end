// lib/taxonomy.ts
export type ShopCategory = {
  label: string;        // "Seating"
  slug: string;         // "seating"
  sub: { label: string; slug: string }[];
};

export const SHOP_TAXONOMY: ShopCategory[] = [
  {
    label: "Seating",
    slug: "seating",
    sub: [
      { label: "Sofas & Loveseats", slug: "sofas-loveseats" },
      { label: "Armchairs", slug: "armchairs" },
      { label: "Dining Chairs", slug: "dining-chairs" },
      { label: "Stools & Benches", slug: "stools-benches" },
      { label: "Office Chairs", slug: "office-chairs" },
    ],
  },
  {
    label: "Tables",
    slug: "tables",
    sub: [
      { label: "Dining Tables", slug: "dining-tables" },
      { label: "Coffee Tables", slug: "coffee-tables" },
      { label: "Side Tables", slug: "side-tables" },
      { label: "Desks", slug: "desks" },
    ],
  },
  {
    label: "Storage",
    slug: "storage",
    sub: [
      { label: "Bookcases & Shelving", slug: "bookcases-shelving" },
      { label: "Dressers", slug: "dressers" },
      { label: "Cabinets", slug: "cabinets" },
      { label: "Sideboards & Hutches", slug: "sideboards-hutches" },
      { label: "TV Stands", slug: "tv-stands" },
    ],
  },
  {
    label: "Lighting",
    slug: "lighting",
    sub: [
      { label: "Table Lamps", slug: "table-lamps" },
      { label: "Floor Lamps", slug: "floor-lamps" },
      { label: "Overhead Lighting", slug: "overhead-lighting" },
    ],
  },
  {
    label: "Decor",
    slug: "decor",
    sub: [
      { label: "Wall Art & Prints", slug: "wall-art-prints" },
      { label: "Frames & Mirrors", slug: "frames-mirrors" },
      { label: "Vases & Accents", slug: "vases-accents" },
      { label: "Collectibles", slug: "collectibles" },
    ],
  },
  {
    label: "Kids",
    slug: "kids",
    sub: [
      { label: "Cribs", slug: "cribs" },
      { label: "Kids Beds", slug: "kids-beds" },
      { label: "Toys", slug: "toys" },
      { label: "Kids Storage", slug: "kids-storage" },
    ],
  },
  {
    label: "Tools & Garage",
    slug: "tools-garage",
    sub: [
      { label: "Hand Tools", slug: "hand-tools" },
      { label: "Power Tools", slug: "power-tools" },
      { label: "Storage & Organizers", slug: "storage-organizers" },
      { label: "Lawn & Garden", slug: "lawn-garden" },
    ],
  },
  {
    label: "Electronics",
    slug: "electronics",
    sub: [
      { label: "TVs", slug: "tvs" },
      { label: "Audio", slug: "audio" },
      { label: "Small Electronics", slug: "small-electronics" },
    ],
  },
];
