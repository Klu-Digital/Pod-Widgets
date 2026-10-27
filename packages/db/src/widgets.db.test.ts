import { getTestDb } from "@k22i/testing/db";
import { describe, expect, it } from "vite-plus/test";

import { page } from "./schema/pages";
import { emptyDoc, textWidget, widget } from "./schema/widgets";

const author = {
  createdBy: "Tester",
  createdById: "00000000-0000-0000-0000-000000000001",
};

describe("widget class table inheritance", () => {
  it("rejects a text_widget without a widget row", async () => {
    const db = getTestDb();

    await expect(
      db.insert(textWidget).values({ widgetId: crypto.randomUUID() })
    ).rejects.toThrow();
  });

  it("defaults text_widget.content to the empty doc", async () => {
    const db = getTestDb();
    const [createdPage] = await db
      .insert(page)
      .values({ ...author, title: "Test" })
      .returning({ id: page.id });
    const [createdWidget] = await db
      .insert(widget)
      .values({ ...author, pageId: createdPage?.id ?? "", type: "text" })
      .returning({ id: widget.id });

    const [row] = await db
      .insert(textWidget)
      .values({ widgetId: createdWidget?.id ?? "" })
      .returning();

    expect(row?.content).toEqual(emptyDoc);
  });
});
