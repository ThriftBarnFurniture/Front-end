// Per-process protection. A shared gateway limiter is still needed for a
// strict deployment-wide quota across multiple serverless instances.
const buckets = new Map<string, { count: number; resetsAt: number }>();
const MAX_BUCKETS = 10000;

export function checkRequestLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetsAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [id, value] of buckets) if (value.resetsAt <= now) buckets.delete(id);
      if (buckets.size >= MAX_BUCKETS) return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
    }
    bucket = { count: 0, resetsAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000)) };
}

export function rateLimitRequest(request: Request, scope: string, limit: number, windowMs: number): Response | null {
  // Vercel supplies this header in production. Forwarded headers on other
  // hosts must be sanitized by their reverse proxy.
  const address = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim().slice(0, 128);
  const result = checkRequestLimit(`${scope}:${address}`, limit, windowMs);
  if (result.allowed) return null;
  return Response.json({ error: "Too many requests. Please wait a moment and try again." }, {
    status: 429,
    headers: { "Retry-After": String(result.retryAfter), "Cache-Control": "no-store" },
  });
}
