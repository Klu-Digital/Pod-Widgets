import { call } from "@orpc/server";
import { page } from "@trumpet-pods/db/schema/pages";
import { getTestDb } from "@trumpet-pods/testing";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import type { Context } from "./context";
import { mutationProcedure } from "./procedures";

/**
 * The queued task reads the row back on a different pool connection from the
 * handler's transaction, so it sees the row only once that transaction
 * committed.
 */

const context = { db: getTestDb(), log: undefined } as unknown as Context;

/**
 * Writes one row, then queues a task reporting whether it was visible from
 * outside the transaction.
 */
const writeThenQueue = (
  report: (seenFromOutside: boolean) => void,
  afterQueueing?: () => void
) =>
  mutationProcedure.handler(async ({ context: ctx }) => {
    const title = crypto.randomUUID();

    await ctx.db
      .insert(page)
      .values({ createdBy: "test", createdById: crypto.randomUUID(), title });

    ctx.afterCommit(async () => {
      const rows = await getTestDb()
        .select()
        .from(page)
        .where(eq(page.title, title));
      report(rows.length === 1);
    });

    afterQueueing?.();
    return { title };
  });

describe("afterCommit", () => {
  it("runs queued work, and only once the transaction has committed", async () => {
    const seen: boolean[] = [];

    await call(
      writeThenQueue((seenFromOutside) => seen.push(seenFromOutside)),
      undefined,
      { context }
    );

    // Ran at all — the middleware used to drop the callback on the floor.
    expect(seen).toHaveLength(1);
    // ...and ran late enough that the row had committed.
    expect(seen[0]).toBe(true);
  });

  it("does not run queued work when the transaction rolls back", async () => {
    const seen: boolean[] = [];

    await expect(
      call(
        writeThenQueue(
          (seenFromOutside) => seen.push(seenFromOutside),
          () => {
            throw new Error("boom");
          }
        ),
        undefined,
        { context }
      )
    ).rejects.toThrow("boom");

    expect(seen).toEqual([]);
    expect(await getTestDb().select().from(page)).toHaveLength(0);
  });

  it("does not fail the mutation when a queued task throws", async () => {
    const procedure = mutationProcedure.handler(({ context: ctx }) => {
      ctx.afterCommit(() => Promise.reject(new Error("invalidation failed")));
      return { ok: true };
    });

    await expect(call(procedure, undefined, { context })).resolves.toEqual({
      ok: true,
    });
  });
});
