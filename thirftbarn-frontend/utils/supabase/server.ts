import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Creates Supabase client that uses cookies instead of localStorage. It can securely
// read logged-in user, fetch protected data and enforce RLS
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Components cannot write cookies; the proxy refreshes them.
          }
        },
      },
    }
  )
}
