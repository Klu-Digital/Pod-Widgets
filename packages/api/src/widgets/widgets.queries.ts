import {
  bannerWidget,
  textWidget,
  widget,
} from "@trumpet-pods/db/schema/widgets";
import type { BannerVariant } from "@trumpet-pods/db/schema/widgets";
import { and, eq, isNull } from "drizzle-orm";

import type { Executor } from "../shared/db";

/** An editor document; the API checks only the root. */
export interface Doc {
  [key: string]: unknown;
  type: "doc";
}

interface WidgetBase {
  createdAt: Date;
  createdBy: string;
  createdById: string;
  id: string;
  pageId: string;
  updatedAt: Date;
}

export type WidgetView = WidgetBase &
  (
    | { type: "text"; content: Doc }
    | { type: "banner"; content: Doc; variant: BannerVariant }
  );

// `type` exists on the base and every sub-table, so columns are named.
const selectWidgets = (db: Executor) =>
  db
    .select({
      bannerContent: bannerWidget.content,
      createdAt: widget.createdAt,
      createdBy: widget.createdBy,
      createdById: widget.createdById,
      id: widget.id,
      pageId: widget.pageId,
      textContent: textWidget.content,
      type: widget.type,
      updatedAt: widget.updatedAt,
      variant: bannerWidget.variant,
    })
    .from(widget)
    .leftJoin(textWidget, eq(textWidget.widgetId, widget.id))
    .leftJoin(bannerWidget, eq(bannerWidget.widgetId, widget.id));

type WidgetRow = Awaited<ReturnType<typeof selectWidgets>>[number];

const toView = (row: WidgetRow): WidgetView => {
  const base = {
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    createdById: row.createdById,
    id: row.id,
    pageId: row.pageId,
    updatedAt: row.updatedAt,
  };
  if (row.type === "text" && row.textContent !== null) {
    return { ...base, content: row.textContent as Doc, type: "text" };
  }
  if (row.type === "banner" && row.bannerContent !== null && row.variant) {
    return {
      ...base,
      content: row.bannerContent as Doc,
      type: "banner",
      variant: row.variant,
    };
  }
  // The composite FK points sub-row to base, so a base row alone is possible.
  throw new Error(`widget ${row.id} has no ${row.type} row`);
};

export const listWidgets = async (
  db: Executor,
  pageId: string
): Promise<WidgetView[]> => {
  const rows = await selectWidgets(db)
    .where(and(eq(widget.pageId, pageId), isNull(widget.deletedAt)))
    .orderBy(widget.createdAt, widget.id);
  return rows.map(toView);
};

/** Live widgets only; a soft-deleted one reads as absent. */
export const findLiveWidget = async (
  db: Executor,
  id: string
): Promise<WidgetView | undefined> => {
  const [row] = await selectWidgets(db).where(
    and(eq(widget.id, id), isNull(widget.deletedAt))
  );
  return row && toView(row);
};
