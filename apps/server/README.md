# server

The Hono HTTP server: better-auth, the oRPC API and metrics. It only produces jobs; `apps/workers` consumes them.

## Boot and migrations

The server image migrates its own database. Its entry, `dist/start.mjs` (`src/start.ts`), applies the drizzle migrations and pg-boss's schema, starts the server, then runs pending post-migration scripts in the background. CI never connects to the database, which in production sits on a private network CI cannot reach.

- **A failed migration exits the container** before it serves traffic.
- **A failed post-migration script is logged** (`server.post_migrate_failed`) and retried on the next boot. Not awaited, so a long backfill does not hold the healthcheck.
- **The scripts are bundled, not discovered.** The runtime image has no source tree or tsx, so `tsdown.config.ts` scans `packages/db/src/post-migration-scripts/` at build time into `virtual:post-migration-scripts`, with the same checksums the CLI computes.
- **Every migration must be backward compatible with the previous image**, which keeps running against the new schema while a deploy rolls and for as long as a rollback window lasts: add nullable columns, never rename or drop in the release that stops using something. Consider a lock timeout on the migration connection (`?options=-c%20lock_timeout%3D15s` on `DATABASE_URL`) so DDL queued behind a long transaction fails fast instead of blocking every query.
- **The compose stack skips all of this.** It overrides the entry to `dist/index.mjs`, since the local database is push-built.
- **The admin CLIs ride along** as `dist/admin/grant.mjs` and `dist/admin/reset-password.mjs`, so `pnpm admin:grant` and `pnpm admin:reset-password` work inside the container (`docker compose exec server pnpm admin:reset-password you@example.com`).

`/` is the liveness probe the image's `HEALTHCHECK` uses; `/health/ready` also touches Postgres and the queue and answers 503 until both are up. nginx in the web image proxies `/health/ready` for an outside uptime monitor.

## Client IP and `TRUSTED_PROXY_HOPS`

The API is reached only through the web image's nginx, so the socket address is always a proxy. Set `TRUSTED_PROXY_HOPS` to the number of proxies in front of the server: `1` for the web image's nginx alone, `2` when another proxy (Traefik, a load balancer) sits in front of nginx.

Each proxy appends the address it saw to `x-forwarded-for`, so `packages/auth/src/client-ip.ts` counts that many entries back from the right; anything further left is whatever the caller sent and is never trusted. Too low and every caller is identified by a proxy's address; too high and callers can pick their own.

The server resolves the address once per request and hands it to both the oRPC `rateLimit()` middleware and better-auth. better-auth never parses `x-forwarded-for` itself: it is handed a `Request`, so it can never see the socket, and its own parsing disagrees with ours. It rejects any chain longer than one entry and then buckets _every_ caller under one shared `no-trusted-ip` key. So the server stamps the resolved address on the request as `x-k22i-client-ip`, overwriting any copy the caller sent, and `advanced.ipAddress.ipAddressHeaders` points better-auth at that header alone. Calling `auth.handler` without `withClientIp` from `@k22i/auth/client-ip` brings the shared bucket back.

## Request hardening

- **Request IDs.** `hono/request-id` runs first, so the ID reaches the logger, the error path and the `x-request-id` response header; an inbound one from the proxy is kept.
- **RPC body limit.** `/rpc` refuses bodies over 1 MiB with a 413 before the handler runs; file contents go straight to the bucket, so no RPC input is larger. nginx's `client_max_body_size` sits just above it so the client gets the server's 413 rather than nginx's HTML one.
- **CSRF header.** `/rpc` requires `x-csrf-token` (`SimpleCsrfProtectionHandlerPlugin`); see the root README's session cookie section.
- **`/api-reference` is not mounted in production.** It is a full REST surface over every procedure.
- **Graceful shutdown.** On SIGTERM the server stops accepting, drains in-flight requests for up to 8 seconds (under Docker's 10-second grace), then flushes logs, quits Redis and stops the queue. `exitOnCrash()` logs and flushes an uncaught error before exiting rather than losing it to stderr.
