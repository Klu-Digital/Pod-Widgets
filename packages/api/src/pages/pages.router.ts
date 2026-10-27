import { z } from "zod";

import { identityMutationProcedure, identityProcedure } from "../procedures";
import { createPage } from "./pages.commands";
import { listPages } from "./pages.queries";

const TITLE_MAX = 200;

export const pagesRouter = {
  create: identityMutationProcedure
    .input(z.object({ title: z.string().trim().min(1).max(TITLE_MAX) }))
    .handler(
      async ({ context, input }) =>
        await createPage(context.db, context.identity, input.title)
    ),
  list: identityProcedure.handler(
    async ({ context }) => await listPages(context.db)
  ),
};
