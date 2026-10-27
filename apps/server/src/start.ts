// Production entry: migrates the database, then starts the server. CI never
// touches the database — in production it sits on a private network only the
// deployed containers reach. Schema first, code second: during a rolling deploy
// (and any rollback window) the PREVIOUS image runs against this schema, so
// every migration must stay backward compatible with it — add nullable
// columns, never rename or drop in the release that stops using something.
import path from "node:path";

// Must load before @trumpet-pods/db, hence the dynamic imports below.
import { log, observability, parseError } from "@trumpet-pods/observability";
import { migrateQueueSchema } from "@trumpet-pods/queue";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import postMigrationScripts from "virtual:post-migration-scripts";

const migrationsFolder = path.resolve(import.meta.dirname, "../migrations");

const { createDb, createPool } = await import("@trumpet-pods/db");
const { runPostMigrations } =
  await import("@trumpet-pods/db/dev-scripts/post-migrate/runner");

try {
  const pool = createPool({ max: 1 });
  try {
    await migrate(createDb(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
  await migrateQueueSchema();
  log.info({ action: "server.migrated" });
} catch (error) {
  log.error({ action: "server.migrate_failed", ...parseError(error) });
  await observability.flush();
  process.exit(1);
}

await import("./index");

// Not awaited, so a long backfill doesn't hold the healthcheck.
void (async () => {
  const outcome = await runPostMigrations({}, () =>
    Promise.resolve(postMigrationScripts)
  );
  if (outcome !== 0) {
    log.error({ action: "server.post_migrate_failed" });
  }
})();
