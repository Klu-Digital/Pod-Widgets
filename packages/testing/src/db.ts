import { createDb } from "@trumpet-pods/db";
import type { Database } from "@trumpet-pods/db";
import { Pool } from "pg";

let pool: Pool | undefined;
let db: Database | undefined;

/** Comma-joined quoted table list for `TRUNCATE`; `undefined` = not discovered. */
let cachedTableList: string | undefined;

/**
 * Reads `process.env.DATABASE_URL` at call time: `setup/db.ts` sets it per
 * worker, possibly after this module was imported.
 */
export const getTestPool = (): Pool => {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
};

/** Lazily creates and memoises a `Database` bound to {@link getTestPool}. */
export const getTestDb = (): Database => {
  if (!db) {
    db = createDb(getTestPool());
  }
  return db;
};

/**
 * Truncates every `public` table — drizzle's migration bookkeeping lives in its
 * own schema.
 * Quoting goes through Postgres's own `format('%I', ...)` so reserved words
 * like `"user"` come out right.
 */
export const truncateAll = async (): Promise<void> => {
  const client = getTestPool();

  if (cachedTableList === undefined) {
    const result = await client.query<{ tables: string | null }>(
      `SELECT string_agg(format('%I', tablename), ', ') AS tables
       FROM pg_tables WHERE schemaname = 'public'`
    );
    cachedTableList = result.rows[0]?.tables ?? "";
  }

  if (cachedTableList) {
    await client.query(`TRUNCATE ${cachedTableList} RESTART IDENTITY CASCADE`);
  }
};

/** Ends the pool and clears every memoised value. */
export const closeTestPool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
  }
  pool = undefined;
  db = undefined;
  cachedTableList = undefined;
};
