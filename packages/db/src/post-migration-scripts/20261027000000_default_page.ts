import { definePostMigration } from "../dev-scripts/post-migrate/define";
import { page } from "../schema";

const SYSTEM_ID = "00000000-0000-0000-0000-000000000000";

export default definePostMigration({
  description: "default page",
  async up({ db, log }) {
    // Idempotent: a second run, or a DB that already has a page, adds nothing.
    const existing = await db.select({ id: page.id }).from(page).limit(1);
    if (existing.length > 0) {
      log.info("page already exists");
      return;
    }
    await db.insert(page).values({
      createdBy: "System",
      createdById: SYSTEM_ID,
      title: "Welcome",
    });
    log.info("inserted default page");
  },
});
