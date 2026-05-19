// In-memory rate limiter — Edge-compatible (no Node.js APIs)

interface RateLimitEntry { count: number; resetAt: number }
const store = new Map<string, RateLimitEntry>();

// Auto-cleanup every 5 minutes (only in Node.js runtime, not Edge)
if (typeof setInterval !== 'undefined' && typeof process !== 'undefined' && process.env?.NEXT_RUNTIME !== 'edge') {
  try {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key);
      }
    }, 5 * 60 * 1000);
  } catch {
    // Edge runtime — cleanup not available, entries expire naturally
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
