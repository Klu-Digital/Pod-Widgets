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
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
