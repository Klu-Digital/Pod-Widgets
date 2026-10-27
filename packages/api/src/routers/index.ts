import type { RouterClient } from "@orpc/server";

import { featureFlagsRouter } from "../feature-flags/feature-flags.router";
import { jobsRouter } from "../jobs/jobs.router";
import { pagesRouter } from "../pages/pages.router";
import { publicProcedure } from "../procedures";
import { widgetsRouter } from "../widgets/widgets.router";

export const appRouter = {
  featureFlags: featureFlagsRouter,
  healthCheck: publicProcedure.handler(() => "OK"),
  jobs: jobsRouter,
  pages: pagesRouter,
  widgets: widgetsRouter,
};
export type AppRouterClient = RouterClient<typeof appRouter>;
