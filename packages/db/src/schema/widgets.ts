import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { oneOf, timestamps, timestamptz } from "./columns";
import { page } from "./pages";

const uuidv7 = sql`uuidv7()`;

export const widgetTypes = ["text", "banner", "image"] as const;
export type WidgetType = (typeof widgetTypes)[number];

export const bannerVariants = ["info", "idea", "warning", "success"] as const;
export type BannerVariant = (typeof bannerVariants)[number];

export const widgetAuditActions = ["created", "deleted", "restored"] as const;
export type WidgetAuditAction = (typeof widgetAuditActions)[number];

/** Must stay equal to `EMPTY_DOC` in `@k22i/ui`; a drift saves a doc the editor rejects. */
export const emptyDoc = {
  content: [{ type: "paragraph" }],
  type: "doc",
};

/** Class Table Inheritance base: one row per widget, one sub-table row by `type`. */
export const widget = pgTable(
  "widget",
  {
    ...timestamps(),
    createdBy: text("created_by").notNull(),
    createdById: uuid("created_by_id").notNull(),
    /** Soft-delete marker; the app never issues a hard delete. */
    deletedAt: timestamptz("deleted_at"),
    id: uuid("id").primaryKey().default(uuidv7),
    pageId: uuid("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    type: text("type", { enum: widgetTypes }).notNull(),
  },
  (table) => [
    check("widget_type_chk", oneOf(table.type, widgetTypes)),
    // Target of the sub-tables' composite FK, so a row can't join the wrong type.
    unique("widget_id_type_key").on(table.id, table.type),
    index("widget_page_id_created_at_idx")
      .on(table.pageId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

export const textWidget = pgTable(
  "text_widget",
  {
    content: jsonb("content").notNull().default(emptyDoc),
    type: text("type", { enum: ["text"] })
      .notNull()
      .default("text"),
    widgetId: uuid("widget_id").primaryKey(),
  },
  (table) => [
    check("text_widget_type_chk", oneOf(table.type, ["text"])),
    foreignKey({
      columns: [table.widgetId, table.type],
      foreignColumns: [widget.id, widget.type],
      name: "text_widget_widget_id_type_fkey",
    }).onDelete("cascade"),
  ]
);

export const bannerWidget = pgTable(
  "banner_widget",
  {
    content: jsonb("content").notNull().default(emptyDoc),
    type: text("type", { enum: ["banner"] })
      .notNull()
      .default("banner"),
    variant: text("variant", { enum: bannerVariants }).notNull(),
    widgetId: uuid("widget_id").primaryKey(),
  },
  (table) => [
    check("banner_widget_type_chk", oneOf(table.type, ["banner"])),
    check("banner_widget_variant_chk", oneOf(table.variant, bannerVariants)),
    foreignKey({
      columns: [table.widgetId, table.type],
      foreignColumns: [widget.id, widget.type],
      name: "banner_widget_widget_id_type_fkey",
    }).onDelete("cascade"),
  ]
);

export const imageWidget = pgTable(
  "image_widget",
  {
    alt: text("alt").notNull().default(""),
    /** Null until the upload is confirmed. */
    storageKey: text("storage_key"),
    type: text("type", { enum: ["image"] })
      .notNull()
      .default("image"),
    widgetId: uuid("widget_id").primaryKey(),
  },
  (table) => [
    check("image_widget_type_chk", oneOf(table.type, ["image"])),
    foreignKey({
      columns: [table.widgetId, table.type],
      foreignColumns: [widget.id, widget.type],
      name: "image_widget_widget_id_type_fkey",
    }).onDelete("cascade"),
  ]
);

export const widgetAudit = pgTable(
  "widget_audit",
  {
    action: text("action", { enum: widgetAuditActions }).notNull(),
    actorId: uuid("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    at: timestamptz("at").defaultNow().notNull(),
    id: uuid("id").primaryKey().default(uuidv7),
    pageId: uuid("page_id").notNull(),
    widgetId: uuid("widget_id")
      .notNull()
      .references(() => widget.id, { onDelete: "cascade" }),
  },
  (table) => [
    check("widget_audit_action_chk", oneOf(table.action, widgetAuditActions)),
    index("widget_audit_page_id_at_idx").on(table.pageId, table.at),
    index("widget_audit_widget_id_idx").on(table.widgetId),
  ]
);
