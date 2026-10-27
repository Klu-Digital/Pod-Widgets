import { setTimeout as sleep } from "node:timers/promises";

import { env } from "@k22i/env/shared-server";
import { initLogger, log, parseError } from "evlog";

import { createDrain } from "./drain";

export const createObservability = (options?: { service?: string }) => {
  const { drain, flush } = createDrain();

  initLogger({
    drain,
    // Falls back to env so apps/workers gets its own service name without
    // re-running this — calling it again would strand the first drain's
    // batching timer.
    env: {
      environment: env.NODE_ENV,
      service: options?.service ?? env.SERVICE_NAME,
    },
  });

  return { drain, flush };
};

export const observability = createObservability();

/** Under Docker's 10s stop grace, so a hung drain cannot keep a crashed process alive. */
const CRASH_FLUSH_TIMEOUT_MS = 5000;

let crashing = false;

const flushThenExit = async () => {
  try {
    await Promise.race([observability.flush(), sleep(CRASH_FLUSH_TIMEOUT_MS)]);
  } finally {
    process.exit(1);
  }
};

const crash = (action: string) => (error: unknown) => {
  if (crashing) {
    return;
  }
  crashing = true;
  log.error({ action, ...parseError(error) });
  void flushThenExit();
};

/**
 * Node's default for an uncaught error prints to stderr and exits, dropping
 * whatever the drain is still batching — usually the very lines that explain
 * the crash. Call once, at the top of a process entrypoint.
 */
export const exitOnCrash = () => {
  process.on("uncaughtException", crash("process.uncaught_exception"));
  process.on("unhandledRejection", crash("process.unhandled_rejection"));
};

export { createError, log, parseError } from "evlog";
