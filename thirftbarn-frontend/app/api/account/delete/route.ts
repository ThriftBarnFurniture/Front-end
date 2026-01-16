import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST() {
  const { user } = await requireUser(); // ensures logged in

  const admin = createSupabaseAdmin();

  // 1) Delete profile row (optional but recommended)
  await admin.from("profiles").delete().eq("id", user.id);

  // 2) Delete auth user
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
