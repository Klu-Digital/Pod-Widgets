import { publicProcedure } from "../procedures";
import { getFeatureFlags } from "./feature-flags.cache";

export const featureFlagsRouter = {
  /** Built by iterating the registry, never by returning whatever rows exist. */
  all: publicProcedure.handler(({ context }) => getFeatureFlags(context.db)),
};
