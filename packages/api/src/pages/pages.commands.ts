import { page } from "@trumpet-pods/db/schema/pages";

import type { Actor, Executor } from "../shared/db";

export const createPage = async (db: Executor, actor: Actor, title: string) => {
  const [created] = await db
    .insert(page)
    .values({ createdBy: actor.name, createdById: actor.id, title })
    .returning();
  if (!created) {
    throw new Error("page insert returned no row");
  }
  return created;
};
