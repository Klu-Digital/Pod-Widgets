import { db } from "@trumpet-pods/db";
import { log, parseError } from "@trumpet-pods/observability";
import type { EvlogVariables } from "@trumpet-pods/observability/hono";
import { sql } from "drizzle-orm";
import type { Hono } from "hono";

/** `/` stays a liveness probe; this is the one that touches dependencies. */
export const mountHealth = (app: Hono<EvlogVariables>) => {
  app.get("/health/ready", async (c) => {
    let database = true;
    try {
      await db.execute(sql`select 1`);
    } catch (error) {
      database = false;
      log.warn({ action: "health.db_unreachable", ...parseError(error) });
    }

    return c.json(
      { database, status: database ? "ready" : "unavailable" },
      database ? 200 : 503
    );
  });
};
