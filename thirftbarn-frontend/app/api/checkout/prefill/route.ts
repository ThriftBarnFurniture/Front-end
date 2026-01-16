import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      return NextResponse.json({
        signedIn: false,
        email: "",
        full_name: "",
        phone: "",
        address: "",
      });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, phone, address")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      signedIn: true,
      email: user.email ?? "",
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
    });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Failed to prefill.", { status: 500 });
  }
}
