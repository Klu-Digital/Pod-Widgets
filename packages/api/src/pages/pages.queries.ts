import { page } from "@trumpet-pods/db/schema/pages";

import type { Executor } from "../shared/db";

export const listPages = async (db: Executor) =>
  await db.select().from(page).orderBy(page.createdAt, page.id);
