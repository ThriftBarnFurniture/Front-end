export type CategoryValue =
  | "seating"
  | "tables"
  | "storage-furniture"
  | "small-storage"
  | "home-office"
  | "beds-mattresses"
  | "home-textiles-rugs"
  | "home-electronics"
  | "lighting"
  | "home-decor"
  | "kitchen"
  | "bathroom-furniture"
  | "tools-equipment"
  | "musical-instruments"
  | "luggage-bags"
  | "baby-kids"
  | "pets"
  | "appliance"
  | "seasonal-outdoor"
  | "laundry-cleaning"
  | "barn-burner";

export type BarnDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Option = { value: string; label: string };

export const CATEGORY_OPTIONS: { value: CategoryValue; label: string }[] = [
  { value: "seating", label: "Seating" },
  { value: "tables", label: "Tables" },
  { value: "storage-furniture", label: "Storage Furniture" },
  { value: "small-storage", label: "Small Storage" },
  { value: "home-office", label: "Home Office" },
  { value: "beds-mattresses", label: "Beds / Mattresses" },
  { value: "home-textiles-rugs", label: "Home Textiles / Rugs" },
  { value: "home-electronics", label: "Home Electronics" },
  { value: "lighting", label: "Lighting" },
  { value: "home-decor", label: "Home Decor" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom-furniture", label: "Bathroom Furniture" },
  { value: "tools-equipment", label: "Tools / Equipment" },
  { value: "musical-instruments", label: "Musical Instruments" },
  { value: "luggage-bags", label: "Luggage / Bags" },
  { value: "baby-kids", label: "Baby / kids" },
  { value: "pets", label: "Pets" },
  { value: "appliance", label: "Appliance" },
  { value: "seasonal-outdoor", label: "Seasonal/Outdoor" },
  { value: "laundry-cleaning", label: "Laundry / Cleaning" },
  { value: "barn-burner", label: "Barn-Burner" },
];

export const SUBCATEGORY_MAP: Record<
  CategoryValue,
  { value: string; label: string }[]
> = {
  seating: [
    { value: "sofa", label: "Sofa" },
    { value: "sofa-bed-futon", label: "Sofa Bed / Futon" },
    { value: "armchair-accent-chair", label: "Armchair / Accent Chair" },
    { value: "ottoman-foot-stool-pouffe", label: "Ottoman / Foot Stool / Pouffe" },
    { value: "stool", label: "Stool" },
    { value: "bench", label: "Bench" },
  ],
  tables: [
    { value: "dining", label: "Dining" },
    { value: "kitchen", label: "Kitchen" },
    { value: "coffee", label: "Coffee" },
    { value: "side", label: "Side" },
    { value: "bar-furniture", label: "Bar Furniture" },
  ],
  "storage-furniture": [
    { value: "dresser", label: "Dresser" },
    { value: "armoire-wardrobe", label: "Armoire / Wardrobe" },
    { value: "open-bookshelf", label: "Open Bookshelf" },
    { value: "closed-cabinet", label: "Closed Cabinet" },
    { value: "corner-fitted", label: "Corner Fitted" },
    { value: "sideboard", label: "Sideboard" },
    { value: "hutch-china-display", label: "Hutch / China Display" },
    { value: "media-tv-stand", label: "Media/ TV stand" },
    { value: "wall-shelves", label: "Wall Shelves" },
  ],
  "small-storage": [
    { value: "utility-carts", label: "Utility Carts" },
    { value: "storage-boxes-baskets", label: "Storage Boxes/ Baskets" },
    { value: "bins-totes", label: "Bins / Totes" },
  ],
  "home-office": [
    { value: "desk", label: "Desk" },
    { value: "desk-chair", label: "Desk Chair" },
    { value: "gaming-chair", label: "Gaming Chair" },
    { value: "filing-cabinet", label: "Filing Cabinet" },
  ],
  "beds-mattresses": [
    { value: "bed-frame", label: "Bed Frame" },
    { value: "mattress", label: "Mattress" },
    { value: "boxspring", label: "Boxspring" },
    { value: "night-stands", label: "Night stands" },
  ],
  "home-textiles-rugs": [
    { value: "rug", label: "Rug" },
    { value: "cushion-pillow", label: "Cushion / Pillow" },
    { value: "window-covering", label: "Window Covering" },
    { value: "fabric-sewing", label: "Fabric / Sewing" },
  ],
  "home-electronics": [
    { value: "tv", label: "TV" },
    { value: "audio", label: "Audio" },
    { value: "computer", label: "Computer" },
  ],
  lighting: [
    { value: "floor-lamp", label: "Floor Lamp" },
    { value: "desk-lamp", label: "Desk Lamp" },
    { value: "light-fixture", label: "Light Fixture" },
  ],
  "home-decor": [
    { value: "wall-art", label: "Wall Art" },
    { value: "wall-accent", label: "Wall Accent" },
    { value: "picture-art-frame", label: "Picture / Art Frame" },
    { value: "vases-bowls", label: "Vases / Bowls" },
    { value: "collectable", label: "Collectable" },
    { value: "plant-pot", label: "Plant / Pot" },
    { value: "mirror", label: "Mirror" },
    { value: "candle-holders", label: "Candle Holders" },
    { value: "clock", label: "Clock" },
  ],
  kitchen: [
    { value: "kitchen-island", label: "Kitchen Island" },
    { value: "small-appliance", label: "Small Appliance" },
    { value: "dish-glasswear", label: "Dish / Glasswear" },
    { value: "pantry", label: "Pantry" },
    { value: "microwave-cart", label: "Microwave / Cart" },
  ],
  "bathroom-furniture": [
    { value: "vanity", label: "Vanity" },
    { value: "sink-fosset", label: "Sink / Fosset" },
    { value: "shower-bath", label: "Shower / Bath" },
  ],
  "tools-equipment": [
    { value: "power", label: "Power" },
    { value: "hand", label: "Hand" },
    { value: "step-stool-ladder", label: "Step Stool/ Ladder" },
    { value: "toolbox", label: "Toolbox" },
    { value: "garbage-recycling", label: "Garbage/Recycling" },
  ],
  "musical-instruments": [
    { value: "piano", label: "Piano" },
    { value: "pump-organ", label: "Pump Organ" },
    { value: "stand", label: "Stand" },
    { value: "case", label: "Case" },
  ],
  "luggage-bags": [
    { value: "hardshell", label: "Hardshell" },
    { value: "softshell-duffle", label: "Softshell / Duffle" },
    { value: "backpack", label: "Backpack" },
    { value: "handbag", label: "Handbag" },
  ],
  "baby-kids": [
    { value: "furniture", label: "Furniture" },
    { value: "toys", label: "Toys" },
    { value: "organization", label: "Organization" },
  ],
  pets: [
    { value: "furniture", label: "Furniture" },
    { value: "supply", label: "Supply" },
  ],
  appliance: [
    { value: "fridge", label: "Fridge" },
    { value: "stove", label: "Stove" },
    { value: "washer-dryer", label: "Washer/ Dryer" },
    { value: "dishwasher", label: "Dishwasher" },
    { value: "freezer", label: "Freezer" },
  ],
  "seasonal-outdoor": [
    { value: "snow", label: "Snow" },
    { value: "lawn", label: "Lawn" },
    { value: "patio", label: "Patio" },
    { value: "garden", label: "Garden" },
    { value: "bicycle", label: "Bicycle" },
    { value: "bbq", label: "BBQ" },
    { value: "raised-planer", label: "Raised Planer" },
    { value: "picnic-table", label: "Picnic table" },
    { value: "exercise-equipment", label: "Exercise Equipment" },
  ],
  "laundry-cleaning": [
    { value: "vacuum", label: "Vacuum" },
    { value: "broom", label: "Broom" },
    { value: "ironing-board", label: "Ironing Board" },
    { value: "hamper", label: "Hamper" },
    { value: "drying-rack", label: "Drying Rack" },
    { value: "cleaning-supply", label: "Cleaning Supply" },
  ],
  "barn-burner": [
    { value: "day-1", label: "Day 1" },
    { value: "day-2", label: "Day 2" },
    { value: "day-3", label: "Day 3" },
    { value: "day-4", label: "Day 4" },
    { value: "day-5", label: "Day 5" },
    { value: "day-6", label: "Day 6" },
    { value: "day-7", label: "Day 7" },
  ],
};

export const ROOM_TAGS = [
  { value: "living-room", label: "Living Room" },
  { value: "dining-room", label: "Dining Room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "office", label: "Office" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "kids-room", label: "Kids Room" },
  { value: "garage", label: "Garage" },
  { value: "hallway", label: "Hallway" },
  { value: "laundry", label: "Laundry" },
  { value: "gaming-bar", label: "Gaming/Bar" },
] as const;

export const COLLECTIONS = [
  { value: "5-and-under", label: "5$ and Under" },
  { value: "antique", label: "Antique" },
  { value: "commercial-hotel", label: "Commercial Hotel" },
  { value: "made-in-canada", label: "Made in Canada" },
  { value: "vintage", label: "Vintage" },
] as const;

export const CONDITION_OPTIONS = [
  { value: "New", label: "New" },
  { value: "Like New", label: "Like New" },
  { value: "Used", label: "Used" },
  { value: "Heavily Used", label: "Heavily Used" },
  { value: "Damaged", label: "Damaged" },
] as const;

export const COLOR_OPTIONS = [
  "Black",
  "White",
  "Gray",
  "Silver",
  "Gold",
  "Beige",
  "Cream",
  "Brown",
  "Tan",
  "Natural Wood",
  "Oak",
  "Walnut",
  "Cherry",
  "Pine",
  "Mahogany",
  "Blue",
  "Navy",
  "Teal",
  "Green",
  "Olive",
  "Red",
  "Burgundy",
  "Pink",
  "Purple",
  "Yellow",
  "Orange",
  "Clear/Glass",
  "Transparent",
  "Multicolor",
  "Brass",
  "Copper",
  "Chrome",
] as const;