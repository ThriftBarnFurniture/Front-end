import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function utcDateString(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Full months elapsed between start and now (UTC), based on calendar months.
// Example: start Jan 15 -> Feb 14 = 0 months; Feb 15 = 1 month.
function monthsElapsedUTC(startISO: string, now = new Date()) {
  const s = new Date(startISO);

  const startY = s.getUTCFullYear();
  const startM = s.getUTCMonth();
  const startD = s.getUTCDate();

  const nowY = now.getUTCFullYear();
  const nowM = now.getUTCMonth();
  const nowD = now.getUTCDate();

  let months = (nowY - startY) * 12 + (nowM - startM);

  // if we haven't reached the same day-of-month yet, subtract 1 month
  if (nowD < startD) months -= 1;

  return Math.max(0, months);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const given = url.searchParams.get("secret");
  const secret = process.env.MONTHLY_DROP_CRON_SECRET;

  if (!secret || given !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const todayUTC = utcDateString(new Date());

  const { data: items, error } = await supabase
    .from("products")
    .select(
      "id, price, is_active, is_monthly_price_drop, monthly_drop_started_at, monthly_drop_amount, monthly_drop_count, original_price"
    )
    .eq("is_monthly_price_drop", true)
    .eq("is_active", true);

  if (error) {
    console.error("Monthly drop fetch error:", error);
    return new NextResponse("Fetch failed", { status: 500 });
  }

  const updates: any[] = [];

  for (const p of items ?? []) {
    const startedAt = p.monthly_drop_started_at;
    if (!startedAt) continue;

    const elapsed = monthsElapsedUTC(startedAt, new Date());
    const alreadyApplied = Number(p.monthly_drop_count ?? 0);

    if (elapsed <= alreadyApplied) continue; // nothing to do

    const amount = Number(p.monthly_drop_amount ?? 10);
    const steps = elapsed - alreadyApplied;
    const currentPrice = Number(p.price ?? 0);

    const newPrice = Math.max(0, currentPrice - amount * steps);

    updates.push({
      id: p.id,
      // ✅ current price changes
      price: newPrice,

      // ✅ track visuals
      original_price: p.original_price ?? currentPrice, // set once
      last_price_before_drop: currentPrice,
      monthly_drop_count: elapsed,
      last_price_drop_at: new Date().toISOString(),

      // optional tick marker (if you kept it)
      monthly_drop_last_tick: todayUTC,
    });
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { error: upsertError } = await supabase
    .from("products")
    .upsert(updates, { onConflict: "id" });

  if (upsertError) {
    console.error("Monthly drop upsert error:", upsertError);
    return new NextResponse("Update failed", { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: updates.length });
}
