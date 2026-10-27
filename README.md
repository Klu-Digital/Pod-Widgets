# Pod Widgets

A small web app for adding independent widgets to a page. Each widget keeps its own content, saves to the backend as you type, and is still there after a refresh.

- **Widgets:** rich-text and banner (info / idea / warning / success) widgets, added with a button and deleted with Undo.
- **Pages:** multiple pages, with an activity log of widget creates, deletes and restores.
- **Identity:** no accounts. You enter a name on first visit and it is kept in the browser, which is how widgets show who created them.

Stack: React + TanStack Router, Hono + oRPC, Postgres + Drizzle, in a pnpm workspace.

```
apps/web       React SPA
apps/server    Hono server (mounts oRPC)
packages/api   oRPC procedures and business logic
packages/db    Drizzle schema, migrations, post-migration scripts
```

## Run it

Requires Node 26 (`nvm use`), pnpm 10+ and Docker.

```bash
pnpm install
pnpm secrets:setup   # creates the .env files with local-only secrets
pnpm dev:infra       # Postgres + MinIO in Docker
pnpm db:deploy       # migrations + the default page
pnpm dev             # web and server, one mprocs pane each
```

Open <http://localhost:2600>. The API is on port 1900.

### In Docker

```bash
pnpm secrets:setup
pnpm docker:up       # builds and starts web, server, Postgres and MinIO
pnpm db:deploy       # the compose server does not migrate on boot
```

Open <http://localhost:2600>. Stop with `pnpm docker:down`.

## Tests

```bash
pnpm test            # everything
pnpm test:unit       # node, no I/O
pnpm test:web        # React components, jsdom
pnpm test:db         # real Postgres via testcontainers (needs Docker)
```

The file name picks the project: `*.db.test.ts` is db, `apps/web/**/*.test.{ts,tsx}` is web, other `*.test.ts` is unit.

Other checks: `pnpm check` (lint + format) and `pnpm check-types`.

## Prompts

The prompts used to build this with Claude Code are in [PROMPTS.md](PROMPTS.md).

## More

[CONTRIBUTING.md](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) (conventions and invariants) · [docs/self-hosting.md](docs/self-hosting.md) · [docs/adr/](docs/adr/)

## License

MIT, see [LICENSE](LICENSE).
