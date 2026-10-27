import { db } from "@k22i/db";
import { log, parseError } from "@k22i/observability";
import { queue } from "@k22i/queue";
import { sql } from "drizzle-orm";
import { Hono } from "hono";

import { mountMetrics } from "./metrics";

/**
 * Not an API: a Docker healthcheck and a Prometheus scrape. No request logger,
 * or a 10s healthcheck would dominate the logs. A factory, so tests can
 * `app.request(...)` without a port.
 */
export const createApp = () => {
  const app = new Hono();

  mountMetrics(app);

  // Reports the queue connection, not just liveness: a worker running but
  // detached from Postgres is exactly what a healthcheck should catch.
  app.get("/", (c) =>
    queue.isStarted() ? c.text("OK") : c.text("queue not started", 503)
  );

  // Readiness: touches the database too. Kept off `/` so the image's
  // healthcheck does not restart a worker over a database blip.
  app.get("/health/ready", async (c) => {
    let database = true;
    try {
      await db.execute(sql`select 1`);
    } catch (error) {
      database = false;
      log.warn({ action: "health.db_unreachable", ...parseError(error) });
    }

    const queueStarted = queue.isStarted();
    const ready = database && queueStarted;

    return c.json(
      {
        database,
        queue: queueStarted,
        status: ready ? "ready" : "unavailable",
      },
      ready ? 200 : 503
    );
  });

  return app;
};
