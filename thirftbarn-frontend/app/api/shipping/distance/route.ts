import { NextResponse } from "next/server";

/**
 * Expects:
 * {
 *   origin: string;      // Store address
 *   destination: string // Customer full address
 * }
 *
 * Returns:
 * {
 *   distance_km: number
 * }
 *
 * NOTE:
 * - Uses Google Distance Matrix API
 * - Requires GOOGLE_PLACES_API_KEY in env
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const origin = String(body?.origin || "").trim();
    const destination = String(body?.destination || "").trim();

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "Origin and destination are required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Places API key not configured." },
        { status: 500 }
      );
    }

    const url =
      "https://maps.googleapis.com/maps/api/distancematrix/json" +
      `?origins=${encodeURIComponent(origin)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&units=metric` +
      `&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Failed to contact Google Distance Matrix API.");
    }

    const data = await res.json();

    const element = data?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      return NextResponse.json(
        { error: "Unable to calculate distance for this address." },
        { status: 400 }
      );
    }

    const meters = Number(element.distance?.value);
    if (!Number.isFinite(meters) || meters <= 0) {
      return NextResponse.json(
        { error: "Invalid distance returned." },
        { status: 400 }
      );
    }

    const distance_km = meters / 1000;

    return NextResponse.json({ distance_km });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Distance calculation failed." },
      { status: 500 }
    );
  }
}
