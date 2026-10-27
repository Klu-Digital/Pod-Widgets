import { call } from "@orpc/server";
import { getTestDb } from "@trumpet-pods/testing";
import { describe, expect, it } from "vite-plus/test";

import type { Context } from "../context";
import { appRouter } from "../routers/index";

const IDENTITY_ID = "0b0f6f0e-1b6e-4d58-9a6a-3f1f2f6f1c11";
const context = {
  db: getTestDb(),
  identityHeaders: { id: IDENTITY_ID, name: "Ada" },
  log: undefined,
} as unknown as Context;

const newPage = async () =>
  await call(appRouter.pages.create, { title: "Board" }, { context });

const newTextWidget = async (pageId: string) =>
  await call(appRouter.widgets.create, { pageId, type: "text" }, { context });

describe("audit", () => {
  it("lists a page's entries newest first, capped by limit", async () => {
    const { id: pageId } = await newPage();
    const { id: otherPageId } = await newPage();
    const { id } = await newTextWidget(pageId);
    await newTextWidget(otherPageId);
    await call(appRouter.widgets.delete, { id }, { context });
    await call(appRouter.widgets.restore, { id }, { context });

    const entries = await call(appRouter.audit.list, { pageId }, { context });

    expect(entries.map((entry) => entry.action)).toEqual([
      "restored",
      "deleted",
      "created",
    ]);
    expect(entries).toSatisfy((rows: typeof entries) =>
      rows.every((row) => row.actorName === "Ada" && row.widgetType === "text")
    );

    const [latest] = await call(
      appRouter.audit.list,
      { limit: 1, pageId },
      { context }
    );
    expect(latest).toEqual(entries[0]);
  });
});
