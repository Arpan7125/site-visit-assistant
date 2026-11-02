/**
 * Sliding-window rate limiter kept in memory. Good enough for one instance and for the demo;
 * on several serverless instances each has its own window (documented limitation; production
 * would use a shared store such as Redis).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const list = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfterSec: Math.ceil((list[0] + windowMs - now) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (!v.some((t) => t > now - windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
