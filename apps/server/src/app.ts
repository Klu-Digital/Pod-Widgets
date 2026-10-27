import { env } from "@trumpet-pods/env/server";
import { honoLogger } from "@trumpet-pods/observability/hono";
import type { EvlogVariables } from "@trumpet-pods/observability/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import { mountHealth } from "./health";
import { mountMetrics } from "./metrics";
import { mountOrpc } from "./orpc";
import { mountSecurityHeaders } from "./security-headers";

export const createApp = () => {
  const app = new Hono<EvlogVariables>();

  // First, so the ID reaches the logger, the error path and the response header
  // alike; an inbound x-request-id from the proxy is kept.
  app.use(requestId());

  app.use(honoLogger());

  app.use("*", (c, next) => {
    // Excluded paths run without a request logger.
    (c.get("log") as EvlogVariables["Variables"]["log"] | undefined)?.set({
      requestId: c.get("requestId"),
    });
    return next();
  });

  // Before CORS and before every route: a response that short-circuits ahead of
  // this middleware is a response that ships with no security headers at all.
  mountSecurityHeaders(app);

  mountMetrics(app);

  app.use(
    "*",
    cors({
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-csrf-token",
        "x-identity-id",
        "x-identity-name",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      exposeHeaders: ["x-request-id"],
      origin: env.CORS_ORIGIN,
    })
  );

  // Liveness: answers while the process is up, whatever its dependencies say.
  app.get("/", (c) => c.text("OK"));

  mountHealth(app);

  mountOrpc(app, { apiReference: env.NODE_ENV !== "production" });

  return app;
};
