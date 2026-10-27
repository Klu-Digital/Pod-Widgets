import { db } from "@trumpet-pods/db";
import type { EvlogVariables } from "@trumpet-pods/observability/hono";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
  context: HonoContext<EvlogVariables>;
}

export const createContext = ({ context }: CreateContextOptions) => ({
  db,
  identityHeaders: {
    id: context.req.header("x-identity-id") || undefined,
    name: context.req.header("x-identity-name") || undefined,
  },
  log: context.get("log"),
});

export type Context = ReturnType<typeof createContext> & {
  /** Set by the outermost mutation, so a nested one defers to its commit. */
  afterCommit?: (task: () => Promise<unknown>) => void;
};
