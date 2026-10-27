import { call } from "@orpc/server";
import { widget, widgetAudit } from "@trumpet-pods/db/schema/widgets";
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

const doc = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc" as const,
});

const newPage = async () =>
  await call(appRouter.pages.create, { title: "Board" }, { context });

describe("widgets", () => {
  it("creates, lists and edits a text widget", async () => {
    const { id: pageId } = await newPage();

    const created = await call(
      appRouter.widgets.create,
      { pageId, type: "text" },
      { context }
    );
    const listed = await call(appRouter.widgets.list, { pageId }, { context });

    expect(listed).toEqual([created]);
    expect(created).toMatchObject({
      createdBy: "Ada",
      createdById: IDENTITY_ID,
      type: "text",
    });

    await call(
      appRouter.widgets.updateContent,
      { content: doc("hello"), id: created.id },
      { context }
    );
    const [edited] = await call(
      appRouter.widgets.list,
      { pageId },
      { context }
    );

    expect(edited).toMatchObject({ content: doc("hello"), type: "text" });
    expect(edited?.updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime()
    );
  });

  it("keeps content independent between widgets on one page", async () => {
    const { id: pageId } = await newPage();
    const first = await call(
      appRouter.widgets.create,
      { pageId, type: "text" },
      { context }
    );
    const second = await call(
      appRouter.widgets.create,
      { pageId, type: "text" },
      { context }
    );

    await call(
      appRouter.widgets.updateContent,
      { content: doc("first"), id: first.id },
      { context }
    );
    const listed = await call(appRouter.widgets.list, { pageId }, { context });

    expect(listed.find((row) => row.id === first.id)).toMatchObject({
      content: doc("first"),
    });
    expect(listed.find((row) => row.id === second.id)).toEqual(second);
  });

  it("rejects a mutation without identity headers and writes nothing", async () => {
    const { id: pageId } = await newPage();

    await expect(
      call(
        appRouter.widgets.create,
        { pageId, type: "text" },
        {
          context: {
            ...context,
            identityHeaders: { id: undefined, name: undefined },
          },
        }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(await getTestDb().select().from(widget)).toHaveLength(0);
  });

  it("soft deletes and restores, auditing each real transition", async () => {
    const { id: pageId } = await newPage();
    const { id } = await call(
      appRouter.widgets.create,
      { pageId, type: "banner", variant: "info" },
      { context }
    );

    await call(appRouter.widgets.delete, { id }, { context });
    await call(appRouter.widgets.delete, { id }, { context });
    expect(
      await call(appRouter.widgets.list, { pageId }, { context })
    ).toHaveLength(0);
    await expect(
      call(appRouter.widgets.updateBanner, { id, variant: "idea" }, { context })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await call(appRouter.widgets.restore, { id }, { context });
    await call(appRouter.widgets.restore, { id }, { context });
    expect(
      await call(appRouter.widgets.list, { pageId }, { context })
    ).toHaveLength(1);

    const audits = await getTestDb().select().from(widgetAudit);
    expect(audits.map((row) => row.action).toSorted()).toEqual([
      "created",
      "deleted",
      "restored",
    ]);
    expect(audits[0]).toMatchObject({ actorId: IDENTITY_ID, actorName: "Ada" });
  });
});
