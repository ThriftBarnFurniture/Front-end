import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireUser } from "@/lib/require-user";

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
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { error } = await supabase.from("promos").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
