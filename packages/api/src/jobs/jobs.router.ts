import { queue } from "@trumpet-pods/queue";
import { z } from "zod";

import { mutationProcedure } from "../procedures";

/**
 * Demonstrates the transactional enqueue path. Delete with the `example.*`
 * registry entries.
 */
export const jobsRouter = {
  enqueueExample: mutationProcedure
    .input(z.object({ message: z.string().min(1).max(512) }))
    .handler(async ({ context, input }) => {
      // `context.db` is the transaction `mutationProcedure` opened, so a
      // later throw rolls the job back too.
      const jobId = await queue.enqueue("example.echo", input, {
        tx: context.db,
      });

      return { jobId };
    }),
};
