import type * as TypeImport__k22i_env_server from "@k22i/env/server";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vite-plus/test";

// One proxy in front, as with the web image's nginx alone.
vi.mock("@k22i/env/server", async (importOriginal) => {
  const actual = await importOriginal<typeof TypeImport__k22i_env_server>();
  return { ...actual, env: { ...actual.env, TRUSTED_PROXY_HOPS: 1 } };
});

const { clientIpFrom, clientIpOf } = await import("./client-ip");

const SOCKET = "10.0.0.1";

describe("clientIpFrom", () => {
  it("uses the socket and ignores x-forwarded-for with no trusted hops", () => {
    expect(clientIpFrom("203.0.113.7", SOCKET, 0)).toBe(SOCKET);
  });

  it("takes the entry the edge proxy appended, not one the caller sent", () => {
    expect(clientIpFrom("198.51.100.66, 203.0.113.7", SOCKET, 1)).toBe(
      "203.0.113.7"
    );
  });

  it("counts back one entry per trusted proxy", () => {
    expect(
      clientIpFrom("198.51.100.66, 203.0.113.7, 172.18.0.5", SOCKET, 2)
    ).toBe("203.0.113.7");
  });

  it("takes the first entry when the chain is shorter than the hops", () => {
    expect(clientIpFrom(" 203.0.113.7 ", SOCKET, 2)).toBe("203.0.113.7");
  });

  it("falls back to the socket when the header is absent or not an address", () => {
    expect(clientIpFrom(null, SOCKET, 1)).toBe(SOCKET);
    expect(clientIpFrom("not-an-ip", SOCKET, 1)).toBe(SOCKET);
  });
});

describe("clientIpOf", () => {
  it("resolves the proxy-appended address from the request", async () => {
    const app = new Hono().get("/", (c) => c.text(clientIpOf(c) ?? ""));

    const response = await app.request("/", {
      headers: { "x-forwarded-for": "198.51.100.66, 203.0.113.7" },
    });

    expect(await response.text()).toBe("203.0.113.7");
  });
});
