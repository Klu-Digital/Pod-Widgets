import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Configuration consumed by the API process and the db tooling. */
export const sharedServerVariables = {
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "production", "staging", "test"])
    .default("development"),
  POSTHOG_HOST: z.url().default("https://eu.i.posthog.com"),
  POSTHOG_PROJECT_API_KEY: z.string().startsWith("phc_").optional(),
  PROMETHEUS_METRICS_PATH: z.string().startsWith("/").optional(),
  PROMETHEUS_METRICS_TOKEN: z.string().min(1).optional(),
  /** Prefixes every key. Set this when several environments share one instance. */
  REDIS_KEY_PREFIX: z.string().min(1).optional(),
  /** Redis-backed features degrade gracefully when unset. */
  REDIS_URL: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  /** Server -> bucket. Omit for real AWS S3. */
  S3_ENDPOINT: z.url().optional(),
  /** Required by MinIO; false for R2 and irrelevant for AWS. */
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  /** Host baked into presigned URLs handed to clients. */
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default("auto"),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** Tags every log line, so a shared drain can distinguish processes. */
  SERVICE_NAME: z.string().min(1).default("trumpet-pods-server"),
  STORAGE_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(26_214_400),
};

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: sharedServerVariables,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
