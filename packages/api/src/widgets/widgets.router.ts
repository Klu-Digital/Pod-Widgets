import { bannerVariants } from "@trumpet-pods/db/schema/widgets";
import { z } from "zod";

import { identityMutationProcedure, identityProcedure } from "../procedures";
import {
  createWidget,
  deleteWidget,
  restoreWidget,
  updateWidgetBanner,
  updateWidgetContent,
} from "./widgets.commands";
import { listWidgets } from "./widgets.queries";

const CONTENT_MAX_BYTES = 102_400;
const ALT_MAX = 500;

// Only the root is checked; the editor owns the rest of the schema.
const contentSchema = z
  .looseObject({ type: z.literal("doc") })
  .refine(
    (doc) => Buffer.byteLength(JSON.stringify(doc)) <= CONTENT_MAX_BYTES,
    "content is too large"
  );

const idSchema = z.object({ id: z.uuid() });
const variantSchema = z.enum(bannerVariants);

const createSchema = z.discriminatedUnion("type", [
  z.object({ pageId: z.uuid(), type: z.literal("text") }),
  z.object({
    content: contentSchema.optional(),
    pageId: z.uuid(),
    type: z.literal("banner"),
    variant: variantSchema,
  }),
  z.object({
    alt: z.string().max(ALT_MAX).optional(),
    pageId: z.uuid(),
    type: z.literal("image"),
  }),
]);

export const widgetsRouter = {
  create: identityMutationProcedure
    .input(createSchema)
    .handler(async ({ context, input }) => {
      const { pageId, ...widget } = input;
      return await createWidget(context.db, context.identity, pageId, widget);
    }),
  delete: identityMutationProcedure
    .input(idSchema)
    .handler(async ({ context, input }) => {
      await deleteWidget(context.db, context.identity, input.id);
    }),
  list: identityProcedure
    .input(z.object({ pageId: z.uuid() }))
    .handler(
      async ({ context, input }) => await listWidgets(context.db, input.pageId)
    ),
  restore: identityMutationProcedure
    .input(idSchema)
    .handler(async ({ context, input }) => {
      await restoreWidget(context.db, context.identity, input.id);
    }),
  updateBanner: identityMutationProcedure
    .input(z.object({ id: z.uuid(), variant: variantSchema }))
    .handler(
      async ({ context, input }) =>
        await updateWidgetBanner(context.db, input.id, input.variant)
    ),
  updateContent: identityMutationProcedure
    .input(z.object({ content: contentSchema, id: z.uuid() }))
    .handler(
      async ({ context, input }) =>
        await updateWidgetContent(context.db, input.id, input.content)
    ),
};
