import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw new Error(authErr.message);
  if (!auth.user) throw new Error("Not signed in.");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", auth.user.id)
    .single();

  if (profileErr) throw new Error(profileErr.message);
  if (!profile?.is_admin) throw new Error("Admins only.");
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const clean = ids.map((x: any) => String(x)).filter(Boolean);

    if (clean.length === 0) return NextResponse.json({ products: {} });

    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("products")
      .select("id,image_url")
      .in("id", clean);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const map: Record<string, { image_url: string | null }> = {};
    for (const p of data ?? []) map[p.id] = { image_url: p.image_url ?? null };

    return NextResponse.json({ products: map });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unauthorized" }, { status: 403 });
  }
}
