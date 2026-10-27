# server

The Hono HTTP server: the oRPC API and metrics.

## Boot and migrations

The server image migrates its own database. Its entry, `dist/start.mjs` (`src/start.ts`), applies the drizzle migrations, starts the server, then runs pending post-migration scripts in the background. CI never connects to the database, which in production sits on a private network CI cannot reach.

- **A failed migration exits the container** before it serves traffic.
- **A failed post-migration script is logged** (`server.post_migrate_failed`) and retried on the next boot. Not awaited, so a long backfill does not hold the healthcheck.
- **The scripts are bundled, not discovered.** The runtime image has no source tree or tsx, so `tsdown.config.ts` scans `packages/db/src/post-migration-scripts/` at build time into `virtual:post-migration-scripts`, with the same checksums the CLI computes.
- **Every migration must be backward compatible with the previous image**, which keeps running against the new schema while a deploy rolls and for as long as a rollback window lasts: add nullable columns, never rename or drop in the release that stops using something. Consider a lock timeout on the migration connection (`?options=-c%20lock_timeout%3D15s` on `DATABASE_URL`) so DDL queued behind a long transaction fails fast instead of blocking every query.
- **The compose stack skips all of this.** It overrides the entry to `dist/index.mjs`, since the local database is push-built.

`/` is the liveness probe the image's `HEALTHCHECK` uses; `/health/ready` also touches Postgres and answers 503 while it is unreachable. nginx in the web image proxies `/health/ready` for an outside uptime monitor.

## Request hardening

- **Request IDs.** `hono/request-id` runs first, so the ID reaches the logger, the error path and the `x-request-id` response header; an inbound one from the proxy is kept.
- **RPC body limit.** `/rpc` refuses bodies over 1 MiB with a 413 before the handler runs; file contents go straight to the bucket, so no RPC input is larger. nginx's `client_max_body_size` sits just above it so the client gets the server's 413 rather than nginx's HTML one.
- **CSRF header.** `/rpc` requires `x-csrf-token` (`SimpleCsrfProtectionHandlerPlugin`).
- **`/api-reference` is not mounted in production.** It is a full REST surface over every procedure.
- **Graceful shutdown.** On SIGTERM the server stops accepting, drains in-flight requests for up to 8 seconds (under Docker's 10-second grace), then flushes logs. `exitOnCrash()` logs and flushes an uncaught error before exiting rather than losing it to stderr.
