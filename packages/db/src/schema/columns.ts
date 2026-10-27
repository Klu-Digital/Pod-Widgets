import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { timestamp } from "drizzle-orm/pg-core";

/**
 * An instant. With time zone so the stored value never depends on the
 * session's `TimeZone` (docs/adr/0003-timestamptz-for-instants.md). Use this,
 * never a bare `timestamp()`.
 */
export const timestamptz = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

/** The usual `createdAt`/`updatedAt` pair. */
export const timestamps = () => ({
  createdAt: timestamptz("created_at").defaultNow().notNull(),
  updatedAt: timestamptz("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * A CHECK body for a status/type column. Text plus CHECK rather than a pg enum:
 * `ALTER TYPE ... ADD VALUE` can't run in a transaction, and removing a value
 * can't be done at all.
 */
export const oneOf = (column: AnyPgColumn, values: readonly string[]) =>
  sql`${column} IN (${sql.join(
    values.map((value) => sql.raw(`'${value}'`)),
    sql`, `
  )})`;
