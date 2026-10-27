import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { sharedServerVariables } from "./shared-server";

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    ...sharedServerVariables,
    CORS_ORIGIN: z.url(),
    PORT: z.coerce.number().int().positive().default(1900),
    /**
     * Proxies we run in front of the server (1 for the web image's nginx alone);
     * that many `x-forwarded-for` entries from the right are trusted. 0 trusts
     * none and uses the socket address.
     */
    TRUSTED_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
