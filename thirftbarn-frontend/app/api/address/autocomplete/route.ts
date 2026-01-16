import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get("q") || "").trim();

  if (text.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return new NextResponse("Missing GEOAPIFY_API_KEY", { status: 500 });

  // Geoapify Address Autocomplete endpoint
  const url =
    `https://api.geoapify.com/v1/geocode/autocomplete` +
    `?text=${encodeURIComponent(text)}` +
    `&format=json` +
    `&apiKey=${encodeURIComponent(key)}` +
    `&limit=6` +
    `&filter=countrycode:ca`;

  const r = await fetch(url, { method: "GET" });
  if (!r.ok) return new NextResponse("Geoapify request failed", { status: 502 });

  const data = await r.json();
  const raw = Array.isArray(data?.results) ? data.results : [];

  // Keep only "complete" addresses that include a house number + street
  const filtered = raw.filter((r: any) => {
  const hasHouse = typeof r.housenumber === "string" && r.housenumber.trim().length > 0;
  const hasStreet =
    typeof r.street === "string" && r.street.trim().length > 0;

    return hasHouse && hasStreet;
  });

  // Optional: de-dupe by formatted string
  const seen = new Set<string>();
  const results = filtered
  .map((r: any) => ({
    place_id: r.place_id,
    formatted: r.formatted,
  }))
  .filter((r: any) => {
    const key = (r.formatted || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .slice(0, 6);

  return NextResponse.json({ results });
}
