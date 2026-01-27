import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function utcDateString(d = new Date()) {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeDayAndPrice(startedAtISO: string, now = new Date()) {
  const started = new Date(startedAtISO);

  // Compare by UTC date boundaries (stable)
  const startUTC = Date.UTC(started.getUTCFullYear(), started.getUTCMonth(), started.getUTCDate());
  const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const daysSinceStart = Math.floor((nowUTC - startUTC) / (1000 * 60 * 60 * 24));
  const day = Math.max(1, Math.min(8, daysSinceStart + 1)); // clamp 1..8

  // Day1=40, Day2=35 ... Day8=5
  const price = Math.max(5, 40 - 5 * (day - 1));
  return { day, price };
}

export async function POST(req: Request) {
    const url = new URL(req.url);
    const given = url.searchParams.get("secret");
    const secret = process.env.BARN_BURNER_CRON_SECRET;

    if (!secret || given !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
    }

  if (!secret || given !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const todayUTC = utcDateString(new Date());

  // Get active barn-burner items
  const { data: items, error } = await supabase
    .from("products")
    .select(
      "id, price, category, collections, barn_burner_started_at, barn_burner_day, barn_burner_last_tick, created_at"
    )
    .eq("category", "barn-burner")
    .eq("is_active", true);

  if (error) {
    console.error("BarnBurner tick fetch error:", error);
    return new NextResponse("Fetch failed", { status: 500 });
  }

  const updates: any[] = [];

  for (const p of items ?? []) {
    const lastTick = p.barn_burner_last_tick ?? null;
    if (lastTick === todayUTC) continue; // already applied today

    const startedAt = p.barn_burner_started_at ?? p.created_at ?? new Date().toISOString();
    const { day, price } = computeDayAndPrice(startedAt, new Date());

    // If day 8 => price 5, remove barn-burner category and add 5-under collection
    if (day >= 8) {
      const current = Array.isArray(p.collections) ? p.collections : [];
      const nextCollections = Array.from(new Set([...current, "5-under"]));

      updates.push({
        id: p.id,
        price,
        barn_burner_day: day,
        barn_burner_started_at: startedAt,
        barn_burner_last_tick: todayUTC,
        category: null, // remove barn burner
        collections: nextCollections,
      });
    } else {
      updates.push({
        id: p.id,
        price,
        barn_burner_day: day,
        barn_burner_started_at: startedAt,
        barn_burner_last_tick: todayUTC,
      });
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // Batch update (one-by-one using upsert on id)
  const { error: upsertError } = await supabase
    .from("products")
    .upsert(updates, { onConflict: "id" });

  if (upsertError) {
    console.error("BarnBurner tick upsert error:", upsertError);
    return new NextResponse("Update failed", { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: updates.length });
}
