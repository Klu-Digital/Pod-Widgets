/**
 * The env floor for every test project. There is no root `.env`, so this is the
 * only source of these vars during tests; `??=` lets the shell, CI, or
 * `setup/db.ts` win. The dead-port `DATABASE_URL` is safe because `pg.Pool`
 * only dials on first query.
 */
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:password@127.0.0.1:1/unused";
process.env.CORS_ORIGIN ??= "http://localhost:2600";
