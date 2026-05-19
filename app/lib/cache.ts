// lib/cache.ts
// In-memory cache with TTL for JSON file reads
// Eliminates redundant disk I/O within the same request window

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Default TTL: 5 seconds — balances freshness vs performance
const DEFAULT_TTL_MS = 5_000;

/**
 * Read from cache or execute the loader and cache the result.
 * Thread-safe for Node.js single-threaded event loop.
 *
 * @param key   Unique cache key (usually the filename)
 * @param ttlMs Time-to-live in milliseconds
 * @param loader  Function that reads from disk / computes the value
 */
export function cached<T>(key: string, loader: () => T, ttlMs = DEFAULT_TTL_MS): T {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  // Return cached value if still valid
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  // Load fresh data and store it
  const data = loader();
  store.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/**
 * Invalidate a specific cache key (call after writes).
 */
export function invalidate(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all cache entries matching a prefix.
 * Useful when a write affects multiple related files.
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear the entire cache. Useful for testing or forced refresh.
 */
export function clearCache(): void {
  store.clear();
}
