import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireUser } from "@/lib/require-user";

const toNullIfEmpty = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const parseNumberOrNull = (v: unknown) => {
  const s = toNullIfEmpty(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const parseDateOrNull = (v: unknown) => {
  const s = toNullIfEmpty(v);
  if (s === null) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "INVALID" : d.toISOString();
};

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    const supabase = await createClient();

    // Admin check
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    if (!profile?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

    const body = await req.json();
    const id = toNullIfEmpty(body.id);
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const rawCode = toNullIfEmpty(body.code);
    if (!rawCode) return NextResponse.json({ error: "Code is required" }, { status: 400 });
    const code = rawCode.toUpperCase().replace(/\s+/g, "-").slice(0, 64);

    const percent_off = parseNumberOrNull(body.percent_off);
    const amount_off = parseNumberOrNull(body.amount_off);

    if (percent_off !== null && Number.isNaN(percent_off)) {
      return NextResponse.json({ error: "percent_off must be a number" }, { status: 400 });
    }
    if (amount_off !== null && Number.isNaN(amount_off)) {
      return NextResponse.json({ error: "amount_off must be a number" }, { status: 400 });
    }

    // Must set exactly one
    if ((percent_off === null && amount_off === null) || (percent_off !== null && amount_off !== null)) {
      return NextResponse.json({ error: "Set exactly one: percent_off OR amount_off" }, { status: 400 });
    }

    if (percent_off !== null && (percent_off <= 0 || percent_off > 100)) {
      return NextResponse.json({ error: "percent_off must be > 0 and <= 100" }, { status: 400 });
    }
    if (amount_off !== null && amount_off <= 0) {
      return NextResponse.json({ error: "amount_off must be > 0" }, { status: 400 });
    }

    const starts_at = parseDateOrNull(body.starts_at);
    const ends_at = parseDateOrNull(body.ends_at);

    if (starts_at === "INVALID") return NextResponse.json({ error: "starts_at is not a valid date" }, { status: 400 });
    if (ends_at === "INVALID") return NextResponse.json({ error: "ends_at is not a valid date" }, { status: 400 });
    if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) {
      return NextResponse.json({ error: "ends_at must be after starts_at" }, { status: 400 });
    }

    const is_active = Boolean(body.is_active);

    const { data, error } = await supabase
      .from("promos")
      .update({ code, percent_off, amount_off, is_active, starts_at, ends_at })
      .eq("id", id)
      .select("id, code, percent_off, amount_off, is_active, starts_at, ends_at, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ promo: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
