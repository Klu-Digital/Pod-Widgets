---
status: superseded
---

Superseded for this project by #8 (auth removed).

# The database enforces tenant integrity

Application code is the only thing keeping one organization's rows away from another's unless the schema says otherwise: nothing stops a child row's `<parent>_id` pointing at another organization's parent except the write path. A single missed check in a new procedure becomes a cross-tenant write the database accepts. We move the guarantee into the schema so that a bug in a procedure fails loudly instead of leaking data.

- **Composite foreign keys.** Parent tables get `UNIQUE (organization_id, id)` (`member` and `file` already have one); children carry their own `organization_id` and reference `(organization_id, <parent>_id)`.
- **`ON DELETE RESTRICT` for references to rows that are archived rather than deleted.** Only deleting an `organization` cascades, so a stray hard delete cannot silently erase history.
- **`CHECK` constraints** for invariants the code already assumes, such as a status column's allowed values (`oneOf()` in `packages/db/src/schema/columns.ts`).

## Consequences

`drizzle-kit generate` cannot emit these constraints safely against existing data, so migrations for them are hand-edited: add each foreign key `NOT VALID`, then `VALIDATE CONSTRAINT` in a separate statement so the table is not locked for the scan. Validate them on a scratch database, because `pnpm db:deploy` fails on the push-built local database.

Join tables gain their own `organization_id`, because a composite key needs the organization on both sides. A nullable reference is narrowed to `SET NULL (<column>)` in the SQL: Drizzle cannot express that form, and nulling `organization_id` as well would violate its `NOT NULL`.
