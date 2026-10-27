import { useQuery } from "@tanstack/react-query";
import type { FeatureFlagName } from "@trumpet-pods/env/flags";
import { FEATURE_FLAG_TTL_MS } from "@trumpet-pods/env/flags";

import { orpc } from "@/utils/orpc";

/** Cached for the same window the server uses; longer only hides staleness. */
const useFeatureFlags = () =>
  useQuery({
    ...orpc.featureFlags.all.queryOptions(),
    refetchOnWindowFocus: true,
    staleTime: FEATURE_FLAG_TTL_MS,
  });

/** Fails closed: `false` while loading and `false` on error. */
export const useFeatureFlag = (name: FeatureFlagName): boolean =>
  useFeatureFlags().data?.[name] ?? false;
