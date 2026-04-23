export const ESTATE_SALE_COLLECTION_PREFIX = "estate-sale:";
export const ESTATE_SALE_PHOTO_COLLECTION_PREFIX = "estate-sale-photo:";

export function slugifyEstateSaleName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isEstateSaleCollection(value: string | null | undefined) {
  return Boolean(value?.startsWith(ESTATE_SALE_COLLECTION_PREFIX) && value.length > ESTATE_SALE_COLLECTION_PREFIX.length);
}

export function isEstateSalePhotoCollection(value: string | null | undefined) {
  return Boolean(
    value?.startsWith(ESTATE_SALE_PHOTO_COLLECTION_PREFIX) &&
      value.length > ESTATE_SALE_PHOTO_COLLECTION_PREFIX.length
  );
}

export function getEstateSaleSlug(value: string) {
  return isEstateSaleCollection(value) ? value.slice(ESTATE_SALE_COLLECTION_PREFIX.length) : slugifyEstateSaleName(value);
}

export function createEstateSaleCollectionValue(nameOrSlug: string) {
  const slug = slugifyEstateSaleName(
    nameOrSlug.startsWith(ESTATE_SALE_COLLECTION_PREFIX)
      ? nameOrSlug.slice(ESTATE_SALE_COLLECTION_PREFIX.length)
      : nameOrSlug
  );

  return slug ? `${ESTATE_SALE_COLLECTION_PREFIX}${slug}` : "";
}

export function createEstateSalePhotoCollectionValue(nameOrSlug: string, photoUrl: string) {
  const slug = slugifyEstateSaleName(
    nameOrSlug.startsWith(ESTATE_SALE_COLLECTION_PREFIX)
      ? nameOrSlug.slice(ESTATE_SALE_COLLECTION_PREFIX.length)
      : nameOrSlug
  );
  const cleanUrl = photoUrl.trim();

  if (!slug || !cleanUrl) return "";

  return `${ESTATE_SALE_PHOTO_COLLECTION_PREFIX}${slug}:${encodeURIComponent(cleanUrl)}`;
}

export type EstateSaleMetadata = {
  slug: string;
  name: string;
  photo_url: string | null;
};

export function coerceEstateSaleCollectionValue(value: string) {
  return value.startsWith(ESTATE_SALE_COLLECTION_PREFIX) ? value : createEstateSaleCollectionValue(value);
}

export function formatEstateSaleName(value: string) {
  const slug = getEstateSaleSlug(value);
  if (!slug) return "";

  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getEstateSalePhotoData(value: string) {
  if (!isEstateSalePhotoCollection(value)) return null;

  const rest = value.slice(ESTATE_SALE_PHOTO_COLLECTION_PREFIX.length);
  const separatorIndex = rest.indexOf(":");
  if (separatorIndex <= 0) return null;

  const slug = rest.slice(0, separatorIndex);
  const encodedUrl = rest.slice(separatorIndex + 1);
  if (!slug || !encodedUrl) return null;

  try {
    return { slug, photoUrl: decodeURIComponent(encodedUrl) };
  } catch {
    return null;
  }
}

export function getEstateSalePhotoUrl(collections: string[], estateCollection?: string) {
  const estateSlug = estateCollection ? getEstateSaleSlug(estateCollection) : null;

  for (const collection of collections) {
    const photoData = getEstateSalePhotoData(collection);
    if (!photoData) continue;
    if (!estateSlug || photoData.slug === estateSlug) return photoData.photoUrl;
  }

  return null;
}

export function formatCollectionLabel(value: string) {
  if (isEstateSaleCollection(value)) return `${formatEstateSaleName(value)} Estate Sale`;

  if (value === "5-and-under" || value === "5-under") return "$5 and Under";

  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function splitEstateSaleCollections(collections: string[]) {
  const estateSaleCollections: string[] = [];
  const regularCollections: string[] = [];

  for (const collection of collections) {
    if (isEstateSaleCollection(collection)) estateSaleCollections.push(collection);
    else if (isEstateSalePhotoCollection(collection)) continue;
    else regularCollections.push(collection);
  }

  return { estateSaleCollections, regularCollections };
}

export function estateSaleShopHref(collectionValue: string) {
  return `/shop?estate=${encodeURIComponent(getEstateSaleSlug(collectionValue))}`;
}
