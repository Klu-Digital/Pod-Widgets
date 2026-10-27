import { auth } from "@k22i/auth";
import { db } from "@k22i/db";
import type { EvlogVariables } from "@k22i/observability/hono";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
  context: HonoContext<EvlogVariables>;
  /**
   * Resolved once per request by the server (`resolveClientIp` in
   * `@k22i/auth/client-ip`), which owns the socket — this package does not
   * depend on `@hono/node-server`.
   */
  ip?: string | undefined;
}

export const createContext = async ({ context, ip }: CreateContextOptions) => {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    auth: null,
    db,
    ip,
    log: context.get("log"),
    session,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>> & {
  /** Set by the outermost mutation, so a nested one defers to its commit. */
  afterCommit?: (task: () => Promise<unknown>) => void;
};
