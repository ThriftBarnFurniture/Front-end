/*
Server helper guard: gets the Supabase user; if not logged in, redirects to /login. Returns { supabase, user }.
*/

import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

/**
 * Server-side helper for pages that require authentication.
 * Returns the authenticated user and an initialized Supabase client.
 * Redirects to /login if the user is not signed in.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  return { supabase, user: data.user };
}
