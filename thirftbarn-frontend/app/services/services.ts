// app/services/services.ts

export type ServiceId =
  | "moving"
  | "junk_removal"
  | "furniture_assembly"
  | "marketplace_pickup_delivery"
  | "donation_pickup";

export type PropertyType = "house" | "apartment" | "condo" | "townhouse";

export type Floor = "main" | "basement" | "upper" | "garage";

export type BoxesRange = "lt_10" | "10_25" | "25_40" | "gt_40";

export type YesNo = "yes" | "no";

export type IndoorOutdoor = "indoor" | "outdoor";

export type Room =
  | "bedroom"
  | "kitchen"
  | "living_room"
  | "dining_room"
  | "office"
  | "garage";

export type Appliance =
  | "fridge"
  | "stove"
  | "dishwasher"
  | "washer"
  | "dryer"
  | "microwave"
  | "freezer"
  | "other";

export const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
];

export const FLOOR_OPTIONS: { value: Floor; label: string }[] = [
  { value: "main", label: "Main" },
  { value: "basement", label: "Basement" },
  { value: "upper", label: "Upper" },
  { value: "garage", label: "Garage" },
];

export const BOXES_RANGE_OPTIONS: { value: BoxesRange; label: string }[] = [
  { value: "lt_10", label: "Less than 10" },
  { value: "10_25", label: "10–25" },
  { value: "25_40", label: "25–40" },
  { value: "gt_40", label: "More than 40" },
];

export const ROOM_OPTIONS: { value: Room; label: string }[] = [
  { value: "bedroom", label: "Bedroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "living_room", label: "Living Room" },
  { value: "dining_room", label: "Dining Room" },
  { value: "office", label: "Office" },
  { value: "garage", label: "Garage" },
];

export const APPLIANCE_OPTIONS: { value: Appliance; label: string }[] = [
  { value: "fridge", label: "Fridge" },
  { value: "stove", label: "Stove" },
  { value: "dishwasher", label: "Dishwasher" },
  { value: "washer", label: "Washer" },
  { value: "dryer", label: "Dryer" },
  { value: "microwave", label: "Microwave" },
  { value: "freezer", label: "Freezer" },
  { value: "other", label: "Other" },
];

export const YES_NO_OPTIONS: { value: YesNo; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const INDOOR_OUTDOOR_OPTIONS: { value: IndoorOutdoor; label: string }[] =
  [
    { value: "indoor", label: "Indoor" },
    { value: "outdoor", label: "Outdoor" },
  ];

export type ServiceMeta = {
  id: ServiceId;
  title: string;
  shortDescription: string;
};

export const SERVICES: ServiceMeta[] = [
  {
    id: "moving",
    title: "Moving",
    shortDescription:
      "Tell us the load/unload details, rooms, and any special requirements.",
  },
  {
    id: "junk_removal",
    title: "Junk Removal",
    shortDescription:
      "Share the pickup info, photos, and any items with remaining value.",
  },
  {
    id: "furniture_assembly",
    title: "Furniture Assembly",
    shortDescription:
      "Send the address and build details (plus a product link if you have one).",
  },
  {
    id: "marketplace_pickup_delivery",
    title: "Marketplace Pickup / Delivery",
    shortDescription:
      "We’ll pick up and deliver your item—add photos and special instructions.",
  },
  {
    id: "donation_pickup",
    title: "Donation Pickup",
    shortDescription:
      "Schedule a donation pickup with photos and any handling notes.",
  },
];
