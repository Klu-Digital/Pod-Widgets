import { z } from "zod";

import { identityProcedure } from "../procedures";
import { listAudit } from "./audit.queries";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const auditRouter = {
  list: identityProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        pageId: z.uuid(),
      })
    )
    .handler(
      async ({ context, input }) =>
        await listAudit(context.db, input.pageId, input.limit)
    ),
};
