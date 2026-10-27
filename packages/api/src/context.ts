import { db } from "@trumpet-pods/db";
import type { EvlogVariables } from "@trumpet-pods/observability/hono";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
  context: HonoContext<EvlogVariables>;
  /**
   * Resolved once per request by the server (`resolveClientIp` in
   * `apps/server/src/client-ip.ts`), which owns the socket — this package does
   * not depend on `@hono/node-server`.
   */
  ip?: string | undefined;
}

export const createContext = ({ context, ip }: CreateContextOptions) => ({
  db,
  ip,
  log: context.get("log"),
});

export type Context = ReturnType<typeof createContext> & {
  /** Set by the outermost mutation, so a nested one defers to its commit. */
  afterCommit?: (task: () => Promise<unknown>) => void;
};
