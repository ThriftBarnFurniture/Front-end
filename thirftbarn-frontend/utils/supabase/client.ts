import { createBrowserClient } from '@supabase/ssr'

// createClient() creates a fresh supabase client tied to the browser and the current user session
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}