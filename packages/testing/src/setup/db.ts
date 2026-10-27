/**
 * Points `process.env.DATABASE_URL` at this worker's own Postgres database,
 * before any "db" project test file loads
 * `@trumpet-pods/*`. Keep the static imports here limited to `pg`, `vite-plus/test` and
 * `./env`: static imports evaluate first, so anything reaching
 * `@trumpet-pods/env/shared-server` freezes its `env` against the dead placeholders for the
 * rest of the worker's life. Load `@trumpet-pods/*` with a dynamic `import()` below —
 * and at the top level, since `beforeAll` runs after the module graph has
 * resolved.
 */
import "./env";
import { Client } from "pg";
import { afterAll, beforeEach, inject } from "vite-plus/test";

const base = inject("postgresUri");

// One database per Vitest worker so test files parallelise without sharing state.
const workerDbName = `trumpet-pods_test_w${process.env.VITEST_POOL_ID ?? "1"}`;

const maintenanceUrl = new URL(base);
maintenanceUrl.pathname = "/postgres";

const maintenanceClient = new Client({
  connectionString: maintenanceUrl.toString(),
});
await maintenanceClient.connect();

try {
  const existing = await maintenanceClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [workerDbName]
  );

  if (existing.rows.length === 0) {
    try {
      await maintenanceClient.query(
        `CREATE DATABASE "${workerDbName}" TEMPLATE "trumpet-pods_template"`
      );
    } catch (error) {
      // Setup files run once per test FILE, not per worker, so two files can race
      // to create this database. `42P04` is `duplicate_database` — it already exists.
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      if (code !== "42P04") {
        throw error;
      }
    }
  }
} finally {
  await maintenanceClient.end();
}

const workerUrl = new URL(base);
workerUrl.pathname = `/${workerDbName}`;
process.env.DATABASE_URL = workerUrl.toString();

// Safe to touch `@trumpet-pods/*` only now — and only dynamically; see the file header.
const { truncateAll, closeTestPool } = await import("../db");

// Fail loudly if a static `@trumpet-pods/*` import creeps back in: a frozen
// DATABASE_URL points every test at the dead placeholder.
const { env } = await import("@trumpet-pods/env/shared-server");
if (env.DATABASE_URL !== process.env.DATABASE_URL) {
  throw new Error(
    `Module-load-ordering regression in packages/testing/src/setup/db.ts: frozen ` +
      `env.DATABASE_URL (${JSON.stringify(env.DATABASE_URL)}) does not match ` +
      `process.env (${JSON.stringify(process.env.DATABASE_URL)}). Something in this file's module ` +
      `graph reached @trumpet-pods/env/shared-server statically, before the assignments above. ` +
      `Make it a dynamic \`await import(...)\`.`
  );
}

beforeEach(truncateAll);

afterAll(closeTestPool);
