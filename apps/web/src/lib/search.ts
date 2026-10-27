import { z } from "zod";

const ignoredSearchValue = z.unknown().transform((): undefined => undefined);

/**
 * A repeated key arrives as an array; coercing anything that is not a string to
 * `undefined` means a mangled link renders the route's empty state instead of
 * a router parse error.
 */
export const optionalSearchString = z
  .string()
  .optional()
  .or(ignoredSearchValue)
  .optional();
