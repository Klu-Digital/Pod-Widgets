import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * Declared on the base builder, so these reach the web client as defined
 * errors — the only codes whose messages are written for people and shown
 * there. Throw anything else (INTERNAL_SERVER_ERROR) when a message is not
 * meant for the person reading it; the web shows a generic one instead.
 */
export const domainErrors = {
  BAD_REQUEST: {},
  CONFLICT: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  PRECONDITION_FAILED: {},
  TOO_MANY_REQUESTS: { data: z.object({ retryAfter: z.number() }) },
  UNAUTHORIZED: {},
};

/** `notFound("File")` → NOT_FOUND "File not found". Another tenant's id reads as missing too. */
export const notFound = (entity: string) =>
  new ORPCError("NOT_FOUND", { message: `${entity} not found` });
