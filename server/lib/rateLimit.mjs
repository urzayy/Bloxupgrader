/**
 * Simple in-memory sliding-window rate limiter for Express / Connect.
 * Keyed by IP (+ optional suffix). Suitable for single-instance Render.
 */

const buckets = new Map();

function prune(now) {
  if (buckets.size < 5000) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * @param {{ windowMs?: number, max?: number, key?: (req) => string }} opts
 */
export function rateLimit({ windowMs = 60_000, max = 30, key } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    prune(now);
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.socket?.remoteAddress || 'unknown';
    const bucketKey = key ? key(req, ip) : ip;
    let entry = buckets.get(bucketKey);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, entry);
    }
    entry.count += 1;
    res.setHeader?.('X-RateLimit-Limit', String(max));
    res.setHeader?.('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.end(JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Try again shortly.' }));
      return;
    }
    next();
  };
}

/** Middleware that only rate-limits matching paths. */
export function rateLimitPaths(paths, opts) {
  const limiter = rateLimit(opts);
  const set = new Set(paths);
  return (req, res, next) => {
    const url = String(req.url || '').split('?')[0];
    if (set.has(url)) return limiter(req, res, next);
    return next();
  };
}
