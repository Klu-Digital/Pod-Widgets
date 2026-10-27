import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  bannerWidget: {
    widget: r.one.widget({
      from: r.bannerWidget.widgetId,
      optional: false,
      to: r.widget.id,
    }),
  },
  imageWidget: {
    widget: r.one.widget({
      from: r.imageWidget.widgetId,
      optional: false,
      to: r.widget.id,
    }),
  },
  page: {
    audits: r.many.widgetAudit(),
    widgets: r.many.widget(),
  },
  textWidget: {
    widget: r.one.widget({
      from: r.textWidget.widgetId,
      optional: false,
      to: r.widget.id,
    }),
  },
  widget: {
    audits: r.many.widgetAudit(),
    bannerWidget: r.one.bannerWidget(),
    imageWidget: r.one.imageWidget(),
    page: r.one.page({
      from: r.widget.pageId,
      optional: false,
      to: r.page.id,
    }),
    textWidget: r.one.textWidget(),
  },
  widgetAudit: {
    page: r.one.page({
      from: r.widgetAudit.pageId,
      optional: false,
      to: r.page.id,
    }),
    widget: r.one.widget({
      from: r.widgetAudit.widgetId,
      optional: false,
      to: r.widget.id,
    }),
  },
}));
