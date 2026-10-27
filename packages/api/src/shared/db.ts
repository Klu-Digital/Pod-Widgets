import type { Database } from "@trumpet-pods/db";

/** Both `Database` and a transaction handle satisfy this. */
export type Executor = Pick<Database, "insert" | "select" | "update">;

/** The caller's `context.identity`; never taken from input. */
export interface Actor {
  id: string;
  name: string;
}
