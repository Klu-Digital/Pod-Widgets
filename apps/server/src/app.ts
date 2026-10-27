import { auth } from "@k22i/auth";
import { withClientIp } from "@k22i/auth/client-ip";
import { env } from "@k22i/env/server";
import { honoLogger } from "@k22i/observability/hono";
import type { EvlogVariables } from "@k22i/observability/hono";
import { createAuthMiddleware } from "evlog/better-auth";
import type { BetterAuthInstance } from "evlog/better-auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import { clientIpOf } from "./client-ip";
import { mountHealth } from "./health";
import { mountMetrics } from "./metrics";
import { mountOrpc } from "./orpc";
import { mountSecurityHeaders } from "./security-headers";

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
  exclude: ["/api/auth/**"],
  maskEmail: true,
});

export const createApp = () => {
  const app = new Hono<EvlogVariables>();

  // First, so the ID reaches the logger, the error path and the response header
  // alike; an inbound x-request-id from the proxy is kept.
  app.use(requestId());

  // The reset path carries its token, and log lines drain to PostHog.
  app.use(honoLogger({ exclude: ["/api/auth/reset-password/**"] }));

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
      allowHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      exposeHeaders: ["x-request-id"],
      origin: env.CORS_ORIGIN,
    })
  );

  app.use("*", async (c, next) => {
    await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
    return next();
  });

  // Liveness: answers while the process is up, whatever its dependencies say.
  app.get("/", (c) => c.text("OK"));

  mountHealth(app);

  // better-auth sees only a `Request`, never the socket, so the server resolves
  // the caller once and stamps it on (see packages/auth/src/client-ip.ts).
  app.on(["POST", "GET"], "/api/auth/*", (c) =>
    auth.handler(withClientIp(c.req.raw, clientIpOf(c)))
  );

  mountOrpc(app, { apiReference: env.NODE_ENV !== "production" });

  return app;
};
