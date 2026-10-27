import type { AppRouterClient } from "@k22i/api/routers/index";
import type { EvlogVariables } from "@k22i/observability/hono";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import { Hono } from "hono";
import { describe, expect, it } from "vite-plus/test";

import { createApp } from "./app";
import { mountOrpc } from "./orpc";

const app = createApp();

const client = (): AppRouterClient => {
  const link = new RPCLink({
    fetch: async (request) => await app.request(request),
    plugins: [new SimpleCsrfProtectionLinkPlugin()],
    url: "http://localhost/rpc",
  });
  return createORPCClient(link);
};

const appWithOrpc = (apiReference: boolean) => {
  const bare = new Hono<EvlogVariables>();
  mountOrpc(bare, { apiReference });
  return bare;
};

describe("GET /", () => {
  it("returns 200 OK for the Docker healthcheck", async () => {
    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });
});

describe("x-request-id", () => {
  it("generates one when absent and echoes an inbound one", async () => {
    const generated = await app.request("/");
    expect(generated.headers.get("x-request-id")).toBeTruthy();

    const echoed = await app.request("/", {
      headers: { "x-request-id": "req-from-proxy" },
    });
    expect(echoed.headers.get("x-request-id")).toBe("req-from-proxy");
  });
});

describe("GET /health/ready", () => {
  it("is 503 until the queue has started, naming what is missing", async () => {
    const response = await app.request("/health/ready");

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ database: true });
  });
});

describe("POST /rpc body limit", () => {
  it("rejects a body over 1MiB with 413 before the handler runs", async () => {
    const response = await app.request("/rpc/healthCheck", {
      body: JSON.stringify({ json: "x".repeat(1024 * 1024) }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(413);
  });
});

describe("POST /rpc CSRF header", () => {
  it("refuses a call without it, as a cross-site form would send", async () => {
    const response = await app.request("/rpc/healthCheck", {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      json: { code: "CSRF_TOKEN_MISMATCH" },
    });
  });
});

describe("/api-reference", () => {
  it("serves the OpenAPI spec when enabled", async () => {
    const response = await appWithOrpc(true).request(
      "/api-reference/spec.json"
    );

    expect(response.status).toBe(200);
  });

  it("is not mounted when disabled, as in production", async () => {
    const response = await appWithOrpc(false).request(
      "/api-reference/spec.json"
    );

    expect(response.status).toBe(404);
  });
});

describe("POST /rpc/healthCheck", () => {
  it("returns OK over real HTTP through the RPC handler", async () => {
    const result = await client().healthCheck();

    expect(result).toBe("OK");
  });
});
