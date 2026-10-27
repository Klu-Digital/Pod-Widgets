import type { RouterClient } from "@orpc/server";

import { featureFlagsRouter } from "../feature-flags/feature-flags.router";
import { jobsRouter } from "../jobs/jobs.router";
import { publicProcedure } from "../procedures";

export const appRouter = {
  featureFlags: featureFlagsRouter,
  healthCheck: publicProcedure.handler(() => "OK"),
  jobs: jobsRouter,
};
export type AppRouterClient = RouterClient<typeof appRouter>;
