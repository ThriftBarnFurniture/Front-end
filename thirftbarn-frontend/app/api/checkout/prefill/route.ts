import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function splitFullName(full: string) {
  const clean = String(full ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return { first_name: "", last_name: "" };
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function parseAddressString(addr: string) {
  // Expected: "street, city, region, postal, country"
  const parts = String(addr ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    street: parts[0] ?? "",
    city: parts[1] ?? "",
    region: parts[2] ?? "",
    postal: parts[3] ?? "",
    country: parts[4] ?? "Canada",
  };
}

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
        first_name: "",
        last_name: "",
        street: "",
        city: "",
        region: "",
        postal: "",
        country: "Canada",
      });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, phone, address")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const full_name = profile?.full_name ?? "";
    const address = profile?.address ?? "";

    const { first_name, last_name } = splitFullName(full_name);
    const { street, city, region, postal, country } = parseAddressString(address);

    return NextResponse.json({
      signedIn: true,

      // original fields (keep these)
      email: user.email ?? "",
      full_name,
      phone: profile?.phone ?? "",
      address,

      // new, checkout-friendly fields
      first_name,
      last_name,
      street,
      city,
      region,
      postal,
      country,
    });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Failed to prefill.", { status: 500 });
  }
}
