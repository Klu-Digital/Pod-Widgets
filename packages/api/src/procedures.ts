import { ORPCError, os } from "@orpc/server";
import { orpcLogger } from "@trumpet-pods/observability/orpc";
import { z } from "zod";

import type { Context } from "./context";
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

const IDENTITY_NAME_MAX = 60;

const identityIdSchema = z.uuid();
const identityNameSchema = z.string().trim().min(1).max(IDENTITY_NAME_MAX);

// Trust-the-client: the headers are self-asserted, not a security boundary.
const identity = o.middleware(({ context, next }) => {
  const { id, name: encodedName } = context.identityHeaders;
  let name: string | undefined;
  try {
    // The web encodes the name: fetch rejects header characters above U+00FF.
    name =
      encodedName === undefined ? undefined : decodeURIComponent(encodedName);
  } catch {
    throw new ORPCError("BAD_REQUEST");
  }
  const parsedId = identityIdSchema.safeParse(id);
  const parsedName = identityNameSchema.safeParse(name);
  if (!(parsedId.success && parsedName.success)) {
    throw new ORPCError("BAD_REQUEST");
  }
  return next({
    context: { identity: { id: parsedId.data, name: parsedName.data } },
  });
});

/**
 * `publicProcedure` that answers BAD_REQUEST without a valid identity and types
 * `context.identity`.
 */
export const identityProcedure = publicProcedure.use(identity);

/**
 * `mutationProcedure` behind the identity check, which runs before the
 * transaction opens so a rejected call never takes a connection.
 */
export const identityMutationProcedure = publicProcedure
  .use(identity)
  .use(afterCommit)
  .use(transaction);
