import type { FeatureFlagName } from "@k22i/env/flags";
import { orpcLogger } from "@k22i/observability/orpc";
import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";
import { isFeatureEnabled } from "./feature-flags/feature-flags.cache";
import { domainErrors } from "./shared/errors";

/**
 * The base builder, for a middleware the ladder below does not cover.
 *
 * @public
 */
export const o = os.$context<Context>().errors(domainErrors);

export const publicProcedure = o.use(orpcLogger());

// `async` on purpose: drizzle's `.transaction()` wants a real `Promise`, and
// the `await` is what holds the SQL transaction open until the rest of the
// chain has settled.
const transaction = o.middleware(({ context, next }) =>
  context.db.transaction(
    async (db) =>
      await next({
        context: {
          db,
        },
      })
  )
);

/**
 * Lets a mutation queue work — cache invalidation, typically — to run after its
 * transaction commits. Called inline, a `cache.del()` purges a key the
 * transaction may still roll back. The `.use()` order below is load-bearing:
 * middleware wraps outside-in, so `.use(transaction).use(afterCommit)` nests
 * the transaction inside this `await` and silently reintroduces the bug. Task
 * errors are logged, never rethrown.
 */
const afterCommit = o.middleware(async ({ context, next }) => {
  // A mutation called from another must wait for the outer commit, not the
  // release of its own savepoint.
  if (context.afterCommit) {
    return next({ context: { afterCommit: context.afterCommit } });
  }
  const tasks: (() => Promise<unknown>)[] = [];

  // `next` is oRPC's continuation, not a Node-style callback.
  // oxlint-disable-next-line node/callback-return
  const result = await next({
    context: {
      afterCommit: (fn: () => Promise<unknown>) => {
        tasks.push(fn);
      },
    },
  });

  for (const task of tasks) {
    await task().catch((error: unknown) => {
      context.log?.error(
        error instanceof Error ? error : new Error(String(error)),
        {
          action: "aftercommit.failed",
        }
      );
    });
  }

  return result;
});

export const mutationProcedure = publicProcedure
  .use(afterCommit)
  .use(transaction);

/**
 * Read through the per-process flag cache, so this is a map lookup rather than
 * a query per call. Use it when a flag should make something unreachable — the
 * web app's `useFeatureFlag` is cosmetic, and the procedure stays callable by
 * anyone who knows its name.
 */
export const requireFlag = (name: FeatureFlagName) =>
  o.middleware(async ({ context, next }) => {
    if (!(await isFeatureEnabled(context.db, name))) {
      // NOT_FOUND, not FORBIDDEN: FORBIDDEN confirms the endpoint exists.
      throw new ORPCError("NOT_FOUND");
    }
    return next();
  });

/**
 * Template primitive with no caller yet; see ./rate-limit.ts.
 *
 * @public
 */
export { rateLimit } from "./rate-limit";
