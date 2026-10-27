import { page } from "@trumpet-pods/db/schema/pages";
import {
  bannerWidget,
  textWidget,
  widget,
  widgetAudit,
} from "@trumpet-pods/db/schema/widgets";
import type {
  BannerVariant,
  WidgetAuditAction,
} from "@trumpet-pods/db/schema/widgets";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { Actor, Executor } from "../shared/db";
import { notFound } from "../shared/errors";
import { findLiveWidget } from "./widgets.queries";
import type { Doc, WidgetView } from "./widgets.queries";

export type NewWidget =
  | { type: "text" }
  | { type: "banner"; variant: BannerVariant; content?: Doc };

const audit = async (
  db: Executor,
  actor: Actor,
  action: WidgetAuditAction,
  target: { pageId: string; widgetId: string }
) => {
  await db.insert(widgetAudit).values({
    action,
    actorId: actor.id,
    actorName: actor.name,
    ...target,
  });
};

const liveWidgetOrThrow = async (
  db: Executor,
  id: string
): Promise<WidgetView> => {
  const found = await findLiveWidget(db, id);
  if (!found) {
    throw notFound("widget");
  }
  return found;
};

export const createWidget = async (
  db: Executor,
  actor: Actor,
  pageId: string,
  input: NewWidget
): Promise<WidgetView> => {
  const [owner] = await db
    .select({ id: page.id })
    .from(page)
    .where(eq(page.id, pageId));
  if (!owner) {
    throw notFound("page");
  }

  const [created] = await db
    .insert(widget)
    .values({
      createdBy: actor.name,
      createdById: actor.id,
      pageId,
      type: input.type,
    })
    .returning({ id: widget.id });
  if (!created) {
    throw new Error("widget insert returned no row");
  }
  const widgetId = created.id;

  // An undefined `content` falls through to the column default.
  switch (input.type) {
    case "text": {
      await db.insert(textWidget).values({ widgetId });
      break;
    }
    case "banner": {
      await db.insert(bannerWidget).values({
        content: input.content,
        variant: input.variant,
        widgetId,
      });
      break;
    }
    default: {
      throw new Error("unreachable widget type");
    }
  }

  await audit(db, actor, "created", { pageId, widgetId });
  return await liveWidgetOrThrow(db, widgetId);
};

export const updateWidgetContent = async (
  db: Executor,
  id: string,
  content: Doc
): Promise<WidgetView> => {
  // `$onUpdate` is per table, so the sub-table write alone leaves this stale.
  const [touched] = await db
    .update(widget)
    .set({ updatedAt: new Date() })
    .where(and(eq(widget.id, id), isNull(widget.deletedAt)))
    .returning({ type: widget.type });
  if (!touched) {
    throw notFound("widget");
  }

  const table = touched.type === "text" ? textWidget : bannerWidget;
  await db.update(table).set({ content }).where(eq(table.widgetId, id));
  return await liveWidgetOrThrow(db, id);
};

export const updateWidgetBanner = async (
  db: Executor,
  id: string,
  variant: BannerVariant
): Promise<WidgetView> => {
  // `$onUpdate` is per table, so the sub-table write alone leaves this stale.
  const [touched] = await db
    .update(widget)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(widget.id, id),
        isNull(widget.deletedAt),
        eq(widget.type, "banner")
      )
    )
    .returning({ id: widget.id });
  if (!touched) {
    throw notFound("widget");
  }

  await db
    .update(bannerWidget)
    .set({ variant })
    .where(eq(bannerWidget.widgetId, id));
  return await liveWidgetOrThrow(db, id);
};

// A repeat call changes no row and so writes no audit entry.
const finishTransition = async (
  db: Executor,
  actor: Actor,
  action: "deleted" | "restored",
  id: string,
  changed: { pageId: string } | undefined
) => {
  if (changed) {
    await audit(db, actor, action, { pageId: changed.pageId, widgetId: id });
    return;
  }
  const [exists] = await db
    .select({ id: widget.id })
    .from(widget)
    .where(eq(widget.id, id));
  if (!exists) {
    throw notFound("widget");
  }
};

export const deleteWidget = async (db: Executor, actor: Actor, id: string) => {
  const [changed] = await db
    .update(widget)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(widget.id, id), isNull(widget.deletedAt)))
    .returning({ pageId: widget.pageId });
  await finishTransition(db, actor, "deleted", id, changed);
};

export const restoreWidget = async (db: Executor, actor: Actor, id: string) => {
  const [changed] = await db
    .update(widget)
    .set({ deletedAt: null })
    .where(and(eq(widget.id, id), isNotNull(widget.deletedAt)))
    .returning({ pageId: widget.pageId });
  await finishTransition(db, actor, "restored", id, changed);
};
