import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Runs before every request, keeps supabase session alive, refreshes expired tokens
// and syncs cookies.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Refresh tokens may span several cookies. Rebuilding the response
          // for each individual cookie discarded the preceding cookie writes.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const previousCookies = response.cookies.getAll()
          response = NextResponse.next({ request: { headers: request.headers } })
          previousCookies.forEach(cookie => response.cookies.set(cookie))
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          response.headers.set('Cache-Control', 'private, no-store')
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}
