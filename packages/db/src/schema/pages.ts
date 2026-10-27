import { sql } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./columns";

const uuidv7 = sql`uuidv7()`;

/** A shared canvas of widgets. Authors are display names, not accounts. */
export const page = pgTable("page", {
  ...timestamps(),
  createdBy: text("created_by").notNull(),
  /** The author's localStorage identity id, not a user row. */
  createdById: uuid("created_by_id").notNull(),
  id: uuid("id").primaryKey().default(uuidv7),
  title: text("title").notNull(),
});
