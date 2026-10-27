import { countHit } from "@k22i/redis";
import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

// A fresh binding rather than importing `o` from `./index`, which re-exports
// `rateLimit` and would close a cycle.
const o = os.$context<Context>();

export interface RateLimitOptions {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. Fixed window, not sliding. */
  window: number;
  /** Defaults to the session user, then the client IP. */
  key?: (context: Context) => string | undefined;
}

/**
 * Buckets by procedure path, and prefers the session id over `context.ip` — the
 * latter is only as trustworthy as `TRUSTED_PROXY_HOPS` makes it. Never fails
 * open on infrastructure: `countHit` counts in Redis when it answers and in an
 * in-process window when it is unset or a command fails (per process, so looser
 * across replicas, but never off). Only an unattributable caller passes
 * uncounted. Alert on `ratelimit.fallback` and `redis.error`.
 */
export const rateLimit = ({ limit, window, key }: RateLimitOptions) =>
  o.middleware(async ({ context, next, path }) => {
    const identity =
      key?.(context) ??
      (context.session?.user.id
        ? `user:${context.session.user.id}`
        : undefined) ??
      (context.ip ? `ip:${context.ip}` : undefined);
    if (!identity) {
      // unattributable caller — nothing to bucket
      return next();
    }

    const count = await countHit(`rl:${path.join(".")}:${identity}`, window);
    if (count > limit) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        data: { retryAfter: window },
      });
    }

    return next();
  });
