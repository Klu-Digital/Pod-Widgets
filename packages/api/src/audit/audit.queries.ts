import { widget, widgetAudit } from "@trumpet-pods/db/schema/widgets";
import { desc, eq } from "drizzle-orm";

import type { Executor } from "../shared/db";

// No `deletedAt` filter: a deleted widget keeps its entries.
export const listAudit = async (db: Executor, pageId: string, limit: number) =>
  await db
    .select({
      action: widgetAudit.action,
      actorName: widgetAudit.actorName,
      at: widgetAudit.at,
      id: widgetAudit.id,
      widgetType: widget.type,
    })
    .from(widgetAudit)
    .innerJoin(widget, eq(widget.id, widgetAudit.widgetId))
    .where(eq(widgetAudit.pageId, pageId))
    .orderBy(desc(widgetAudit.at), desc(widgetAudit.id))
    .limit(limit);
