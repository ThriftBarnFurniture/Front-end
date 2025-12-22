// app/api/google-reviews/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const placeId = process.env.GOOGLE_PLACE_ID;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!placeId || !apiKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_PLACE_ID or GOOGLE_PLACES_API_KEY" },
      { status: 500 }
    );
  }

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=rating,user_ratings_total` +
    `&key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  const total = data?.result?.user_ratings_total ?? null;
  const rating = data?.result?.rating ?? null;

  return NextResponse.json({ total, rating });
}
