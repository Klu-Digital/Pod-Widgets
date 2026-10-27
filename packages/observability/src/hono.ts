import { evlog } from "evlog/hono";

import { observability } from "./index";

export const honoLogger: typeof evlog = (options) =>
  evlog({ ...options, drain: observability.drain });

export type { EvlogVariables } from "evlog/hono";
