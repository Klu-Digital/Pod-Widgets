---
status: superseded
---

Superseded for this project: Redis and `rateLimit()` were removed while nothing used them. Restore both from git history and follow this again if rate limiting comes back.

# Optional infrastructure fails open, except security and cost limits

Redis, object storage and the queue are optional, and callers degrade when they are absent: with `REDIS_URL` unset the cache is a pass-through and the server boots normally. That is right for a cache and wrong for a limiter. With the same rule applied to rate limits, a missing or failing Redis silently removed every limit, and "no 429s in the logs" was indistinguishable from a working limiter.

Security and cost limits therefore never vanish. Rate limits, such as the oRPC `rateLimit()` middleware, count through `countHit` in `@trumpet-pods/redis`, which falls back to an in-process window when Redis is absent or errors (per process, so looser across replicas, but never open). Nothing is rejected because Redis is down, so a Redis outage is still not an outage for callers.

New callers must follow both halves: degrade for caching, count for limits. Alert on `redis.error` and `ratelimit.fallback`.
