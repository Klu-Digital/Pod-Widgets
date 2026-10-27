import { page } from "@trumpet-pods/db/schema/pages";
import { env } from "@trumpet-pods/env/shared-server";
import { getTestDb } from "@trumpet-pods/testing/db";
import { describe, expect, it } from "vite-plus/test";

// Regression test for the module-load ordering bug in `setup/db.ts`: a static
// `@trumpet-pods/*` import there used to freeze `@trumpet-pods/env/shared-server` against the
// placeholder DATABASE_URL, so every test ran against `127.0.0.1:1`.
describe("test harness module-load ordering", () => {
  it("resolves @trumpet-pods/env/shared-server's env.DATABASE_URL to this worker's real database URL", () => {
    expect(env.DATABASE_URL).toBe(process.env.DATABASE_URL);
  });

  it("points at a per-worker database, never the template or the dev database", () => {
    expect(env.DATABASE_URL).toContain("trumpet-pods_test_w");
    // The dev database on :4400 holds real data; the suite must never reach it.
    expect(env.DATABASE_URL).not.toContain("4400");
  });
});

// These two pass in this order only if `beforeEach(truncateAll)` actually runs
// between them — the isolation `setup/db.ts` promises, proven rather than assumed.
describe("truncateAll isolation between tests", () => {
  it("inserts a row into the page table", async () => {
    const db = getTestDb();

    await db.insert(page).values({
      createdBy: "Harness",
      createdById: crypto.randomUUID(),
      title: "Harness Page",
    });

    const rows = await db.select().from(page);
    expect(rows).toHaveLength(1);
  });

  it("starts with an empty page table, proving truncateAll ran before this test", async () => {
    const db = getTestDb();

    const rows = await db.select().from(page);
    expect(rows).toHaveLength(0);
  });
});
