import { isIP } from "node:net";

import { getConnInfo } from "@hono/node-server/conninfo";
import { env } from "@trumpet-pods/env/server";
import type { Context } from "hono";

// Each proxy appends the address it saw, so only the last `hops` entries were
// written by a proxy we run; anything left of them is whatever the caller sent.
export const clientIpFrom = (
  forwardedFor: string | null,
  remoteAddress: string | undefined,
  hops: number
): string | undefined => {
  if (hops === 0) {
    return remoteAddress;
  }
  const chain = (forwardedFor ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  // A shorter chain was written by trusted proxies only, so its first entry is the client.
  const candidate = chain.at(-Math.min(hops, chain.length));
  // The proxy's address over an unreadable one: a shared bucket, never none.
  return candidate && isIP(candidate) ? candidate : remoteAddress;
};

const resolveClientIp = (
  headers: Headers,
  remoteAddress: string | undefined
): string | undefined =>
  clientIpFrom(
    headers.get("x-forwarded-for"),
    remoteAddress,
    env.TRUSTED_PROXY_HOPS
  );

// `getConnInfo` throws without a Node socket, as in tests.
const remoteAddressOf = (c: Context): string | undefined => {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    // No socket to read (tests); the caller treats the address as unknown.
    return undefined;
  }
};

/** The socket is only reachable from `@hono/node-server`, so resolve it here. */
export const clientIpOf = (c: Context): string | undefined =>
  resolveClientIp(c.req.raw.headers, remoteAddressOf(c));
