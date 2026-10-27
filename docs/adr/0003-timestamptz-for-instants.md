---
status: accepted
---

# Instants are `timestamptz`; calendar days are `date`

Every timestamp column was `timestamp without time zone`, so what a value meant depended on the connection's time zone. Columns that record an instant (`created_at`, session and token expiry) are `timestamptz`, as Postgres guidance recommends, including better-auth's tables. Values that are calendar days stay `date` and are interpreted in the relevant time zone, never converted through an instant.

The migration alters every column with `USING col AT TIME ZONE 'UTC'`, which is correct only because every writer stored UTC; confirm that before running it against a database you care about. Shared column helpers in `packages/db/src/schema/columns.ts` (`timestamptz()`, `timestamps()`) keep new tables from reintroducing the bare `timestamp`.
