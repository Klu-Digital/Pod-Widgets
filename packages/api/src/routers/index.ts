import type { RouterClient } from "@orpc/server";

import { auditRouter } from "../audit/audit.router";
import { featureFlagsRouter } from "../feature-flags/feature-flags.router";
import { pagesRouter } from "../pages/pages.router";
import { publicProcedure } from "../procedures";
import { widgetsRouter } from "../widgets/widgets.router";

export const appRouter = {
  audit: auditRouter,
  featureFlags: featureFlagsRouter,
  healthCheck: publicProcedure.handler(() => "OK"),
  pages: pagesRouter,
  widgets: widgetsRouter,
};
export type AppRouterClient = RouterClient<typeof appRouter>;
