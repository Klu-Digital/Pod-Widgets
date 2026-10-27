---
status: accepted
---

# Routers are transport; logic lives in queries and commands

Left alone, business logic accumulates in oRPC routers, routers start importing each other, and helpers get copied per feature. Workers cannot reuse the logic without importing a router, and cycles follow.

A `*.router.ts` holds only input schemas, the procedure rung, permissions and a call into the feature's `*.queries.ts` (reads) or `*.commands.ts` (writes), which are plain `(db, organizationId, …)` functions. Cross-feature helpers live in `packages/api/src/shared/` (`errors.ts` to start: `domainErrors` and `notFound`). Only `routers/index.ts` and `routers/admin.ts` may import a router; an oxlint `no-restricted-imports` rule enforces it, because a convention alone does not stop the cycles.

The same tenant-scoped functions are what workers and any other entry point call, so there is one definition of each read and write.
