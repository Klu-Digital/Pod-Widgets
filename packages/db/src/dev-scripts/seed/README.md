# seed

Populates a local database with dev data. No seeders are registered right now (the user seeder went with the auth tables), so `pnpm db:seed` is a no-op that keeps `pnpm db:reset` working. The default page comes from a post-migration script, not from here.

## Quick start

```bash
pnpm db:start && pnpm db:purge --yes && pnpm db:deploy
pnpm db:seed
```

## Flags

```
pnpm db:seed [--seed <n>] [--dry-run]
```

| flag | effect |
| --- | --- |
| `--seed <n>` | faker seed — same value, same generated data (default 22) |
| `--dry-run` | plan and check for conflicts, then stop without writing anything |

## Conflicts fail loudly

There's no upsert and no silent skip. Before anything is written, every seeder's `conflicts` runs; if any row would collide, the run stops, lists exactly which, and writes nothing at all. Plan everything first, refuse on any collision, write only if the whole batch is clean.

## Adding a seeder

A seeder is `plan` → `conflicts` → `apply`, defined with `defineSeeder` from [`../define.ts`](./define.ts):

```ts
import { eq } from "drizzle-orm";

import { widget } from "../../../schema";
import { defineSeeder } from "../define";

export const widgetsSeeder = defineSeeder<{ widgets: NewWidget[] }>({
  name: "widgets",

  async plan({ faker }) {
    return { widgets: widgetFactory.buildList(10) };
  },

  async conflicts({ db }, { widgets }) {
    // check for pre-existing rows that would collide; return their keys
    return [];
  },

  async apply({ db, log }, { widgets }) {
    await db.insert(widget).values(widgets);
    log(`created ${widgets.length} widgets`);
  },
});
```

Then add it to the `SEEDERS` list in [`runner.ts`](./runner.ts). `plan` must not touch the database — it's also what powers `--dry-run`. `conflicts` runs for every seeder _before_ any seeder's `apply` runs, so one seeder finding a collision stops the whole run before a different seeder has written anything.

## Factories: fishery + faker

Anything seeded with a raw `db.insert(...)`, though, should build its rows with [fishery](https://github.com/thoughtbot/fishery) + [`@faker-js/faker`](https://fakerjs.dev) instead of hand-writing objects.

A factory is a function from an optional partial override to a full row:

```ts
// packages/db/src/dev-scripts/seed/seeders/widgets.factory.ts
import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import type { widget } from "../../../schema";

type NewWidget = typeof widget.$inferInsert;

export const widgetFactory = Factory.define<NewWidget>(
  ({ sequence, params }) => ({
    name: params.name ?? faker.commerce.productName(),
    slug: faker.helpers.slugify(`widget-${sequence}`).toLowerCase(),
    description: faker.lorem.sentence(),
    ownerId: params.ownerId!, // no sensible default — pass it in from the seeder
  })
);
```

Use it from a seeder's `plan`:

```ts
widgetFactory.build(); // one row, everything defaulted
widgetFactory.build({ name: "Custom name" }); // override a field
widgetFactory.buildList(20, { ownerId }); // twenty, sharing an owner
widgetFactory.params({ description: "" }).buildList(5); // reusable override set
```

A factory only builds plain objects — it never touches the database. The seeder's `apply` does the actual `db.insert(...)`. And `faker.seed(...)` is already called once per run by the CLI's `--seed` flag before any seeder's `plan` runs, so a factory built from the shared `faker` import is reproducible for free — no need to seed it again yourself.

See the [fishery](https://github.com/thoughtbot/fishery#readme) and [faker](https://fakerjs.dev/api/) docs for the full API — associations, traits (`Factory.define` + `.params`), `afterBuild`, and faker's full module list (`faker.commerce`, `faker.date`, `faker.helpers.arrayElement`, ...).
