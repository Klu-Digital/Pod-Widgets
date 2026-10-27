import { countHit } from "@k22i/redis";
import type { BetterAuthOptions } from "better-auth";

// Not re-exported from better-auth's root entry, so derive it rather than
// reaching into a deep import path.
type RateLimitStorage = NonNullable<
  NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]
>;

/**
 * Backs better-auth's `rateLimit.customStorage`, and only that. Do not
 * "simplify" this into `secondaryStorage`: better-auth then stops writing the
 * Postgres `session` row, which makes the `activeOrganizationId` repair in
 * `./index.ts` invisible to `findSession` and 403s every new user. Never set
 * `rateLimit.storage`: "secondary-storage" throws at startup and anything else
 * is redundant.
 *
 * Always returned, Redis or not: `countHit` counts in Redis when it answers and
 * in process memory when it is unset or failing, so a Redis outage loosens the
 * limit to per-process rather than lifting it — and never rejects a sign-in.
 */
export const resolveRateLimitStorage = (): RateLimitStorage => ({
  async consume(key, rule) {
    // Namespaced away from the oRPC middleware's `rl:` keys and the cache's —
    // all three share one Redis database.
    const count = await countHit(`auth-rl:${key}`, rule.window);
    if (count <= rule.max) {
      return { allowed: true, retryAfter: null };
    }
    return { allowed: false, retryAfter: rule.window };
  },
});
