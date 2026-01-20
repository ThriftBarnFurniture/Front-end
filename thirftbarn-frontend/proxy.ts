/*
Next.js middleware entrypoint: calls updateSession() (Supabase middleware helper) on most routes, excluding static/image files.
*/

import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}
