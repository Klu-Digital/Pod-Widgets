import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { env } from "@trumpet-pods/env/server";
// Initializes the logger at module scope, so it must come before ./app, which
// pulls in @trumpet-pods/db. Keep this import first.
import { exitOnCrash, log, observability } from "@trumpet-pods/observability";
import { redis } from "@trumpet-pods/redis";

import { createApp } from "./app";

// Logs and flushes an uncaught error before exiting, rather than losing it to
// stderr with whatever the drain was still batching.
exitOnCrash();

/** Under Docker's 10s stop grace, so the flush below still runs before SIGKILL. */
const SHUTDOWN_DRAIN_MS = 8000;

const server = serve(
  {
    fetch: createApp().fetch,
    port: env.PORT,
  },
  (info) => {
    log.info({ action: "server.listening", port: info.port });
  }
);

const close = async (httpServer: ServerType): Promise<"closed"> => {
  try {
    await promisify(httpServer.close.bind(httpServer))();
  } catch {
    // Already closed: nothing left to drain.
  }
  return "closed";
};

// Deadline because a streamed response can hold a connection open forever.
const drain = async (httpServer: ServerType): Promise<void> => {
  const outcome = await Promise.race([
    close(httpServer),
    sleep(SHUTDOWN_DRAIN_MS, "timeout" as const),
  ]);
  if (outcome === "timeout" && "closeAllConnections" in httpServer) {
    httpServer.closeAllConnections();
  }
};

let shuttingDown = false;

const handleShutdownSignal = (signal: "SIGTERM" | "SIGINT") => {
  // A second Ctrl-C during a long drain should not start a second shutdown.
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  void (async () => {
    log.info({ action: "server.shutdown", signal });
    await drain(server);
    // allSettled, not all: a failed Redis quit must not prevent the log flush.
    await Promise.allSettled([observability.flush(), redis.quit()]);
    process.exit(0);
  })();
};

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => handleShutdownSignal(signal));
}
