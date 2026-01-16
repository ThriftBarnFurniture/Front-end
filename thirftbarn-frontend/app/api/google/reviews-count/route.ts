import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET() {
  try {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID;

    if (!key) return new NextResponse("Missing GOOGLE_PLACES_API_KEY", { status: 500 });
    if (!placeId) return new NextResponse("Missing GOOGLE_PLACE_ID", { status: 500 });

    // Place Details (Legacy) - simplest way to fetch rating + user_ratings_total
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=rating,user_ratings_total` +
      `&key=${encodeURIComponent(key)}`;

    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) throw new Error(`Google Places error: ${res.status}`);

    const json = await res.json();

    const result = json?.result;
    const count = Number(result?.user_ratings_total ?? 0);
    const rating = Number(result?.rating ?? 0);

    return NextResponse.json({ count, rating });
  } catch (e: any) {
    return new NextResponse(e?.message || "Failed to fetch review count.", { status: 500 });
  }
}