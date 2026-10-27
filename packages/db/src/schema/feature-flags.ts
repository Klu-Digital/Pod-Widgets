import { sql } from "drizzle-orm";
import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./columns";

/** Postgres 18+ native time-ordered UUID, used as the default for every id column. */
const uuidv7 = sql`uuidv7()`;

/**
 * The runtime value of a feature flag. Flags are declared in code
 * (`featureFlagRegistry` in `@trumpet-pods/env/flags`); this table only overrides the
 * declared default, so a row exists only once an admin has touched it and a
 * newly declared flag works on first boot. Global on purpose: no
 * `organizationId`, no per-user targeting.
 */
export const featureFlag = pgTable("feature_flag", {
  ...timestamps(),
  enabled: boolean("enabled").notNull(),
  id: uuid("id").primaryKey().default(uuidv7),
  /**
   * Plain text rather than a pg enum: deleting a flag from code then leaves a
   * harmless orphan row instead of requiring a migration before the code change
   * can ship.
   */
  name: text("name").notNull().unique(),
});
