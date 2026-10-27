# trumpet-pods

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - [coss ui](https://coss.com/ui) primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Node.js** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Vite+** - Unified Vite toolchain, workspace task runner, linting, and formatting

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Set up local configuration with the idempotent bootstrap command:

```bash
pnpm secrets:setup
pnpm secrets:check
```

It creates the app `.env` files, generates only locally safe secrets, and keeps external provider credentials out of local development — no PostHog, Tailscale, Dokploy or cloud account is needed to run `pnpm dev`.

Deployment is the same command with an environment:

```bash
pnpm secrets:setup --environment staging
pnpm secrets:check --environment staging
```

The wizard asks provider by provider, decides for itself which values are GitHub Secrets, GitHub Variables or Dokploy runtime variables, shows you the destinations before it writes anything, then applies and verifies. Deployment secrets are held in memory and written straight to GitHub and Dokploy — never to a local file. Rerunning it resumes: names that already exist remotely are skipped, never rotated. Runtime validation still lives in `packages/env`; see [Secrets and configuration](docs/secrets-and-configuration.md) for what each value is and where it comes from.

### Starting a new project from this template

```bash
pnpm rename my-app
```

Renames the npm scope, the workspace packages, the Compose project and container names, the Postgres database, and every mention in prose — reading the current name from the root `package.json`, so it stays re-runnable. Pass `--dry-run` first to see what it would touch. It refuses to run against a dirty working tree unless given `--force`, so that `git checkout .` is always an undo, and it prints any occurrence it could not safely rewrite (the name embedded in a camelCase identifier) rather than leaving it silently behind.

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply migrations and post-migration scripts to your database:

```bash
pnpm run db:deploy
```

`db:migrate` alone is not enough: reference rows and backfills live in post-migration scripts, never in migration SQL. In production the server image does both on boot — see [Deployment](#deployment).

Then, run the development server:

```bash
pnpm run dev
```

`pnpm run dev` brings up the infrastructure containers and then opens [mprocs](https://github.com/pvolok/mprocs), a small terminal UI that gives each process its own pane and its own scrollback rather than interleaving everything into one stream. `web` and `server` start automatically; `infra` (container logs) is listed but idle — select one and press `s` to start it.

| Key |  |
| --- | --- |
| `j` / `k` | move between processes |
| `C-a` | toggle between the process list and the focused pane's terminal |
| `s` / `x` / `r` | start / stop / restart the selected process |
| `q` | quit everything |

The panes are configured in [`mprocs.yaml`](mprocs.yaml). `C-a` is what lets you type into a process.

Open [http://localhost:2600](http://localhost:2600) in your browser to see the web application. The API is running at [http://localhost:1900](http://localhost:1900).

### Ports

| Service         | Default | Override with                             |
| --------------- | ------- | ----------------------------------------- |
| server          | `1900`  | `PORT` (env var or `apps/server/.env`)    |
| web             | `2600`  | `WEB_PORT` (env var; `PORT` also honored) |
| postgres        | `4400`  | `POSTGRES_PORT`                           |
| minio (S3 API)  | `5300`  | `MINIO_PORT`                              |
| minio (console) | `5301`  | `MINIO_CONSOLE_PORT`                      |

For Docker Compose, set `SERVER_PORT` / `WEB_PORT` (e.g. in a root `.env` file) to remap both the published ports and the wiring between services.

### Post-migration scripts

Some schema changes need data backfilled, not just structure changed — a calculated column added by a migration, say, that every existing row needs a value for. Those live as TypeScript scripts in `packages/db/src/post-migration-scripts/`, alongside the drizzle migrations they follow:

```bash
pnpm db:post-migrate:new "backfill user slug"   # scaffold a new script
pnpm db:post-migrate                            # run everything pending
pnpm db:post-migrate:status                     # see what's run and what hasn't
```

See [`packages/db/src/dev-scripts/post-migrate/README.md`](packages/db/src/dev-scripts/post-migrate/README.md) for the full authoring guide.

## UI Customization

React web apps in this stack share [coss ui](https://coss.com/ui) primitives through `packages/ui`. coss ui is a Base UI + Tailwind component set distributed through the shadcn CLI, so the registry is wired up in `components.json` as `@coss` and the files are vendored, not installed. Only the primitives the app imports are vendored; add the rest on demand.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust aliases, registries or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add @coss/accordion @coss/dialog @coss/popover -c packages/ui

# or re-sync the whole set
npx shadcn@latest add @coss/ui --overwrite -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@trumpet-pods/ui/components/button";
```

### Page titles and breadcrumbs

A screen names itself once. `head()` on the route is the single source for both the document title and the breadcrumb trail — `AppBreadcrumbs` (`apps/web/src/components/app-breadcrumbs.tsx`) walks the matched routes and takes whichever `meta` entry carries a `title`.

```tsx
export const Route = createFileRoute("/_app/reports")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Reports" }] }),
});
```

That is the whole contract for a static screen. Nesting is implicit: `/reports` contributes "Reports", `/reports/$reportId` contributes its own title, and the trail follows the route tree rather than a hand-maintained table of paths. A route that sets no title contributes no crumb, which is how pathless layouts like `_app` stay out of the trail.

A dynamic segment names itself from its data. `head()` runs after the loader and receives `loaderData`, so the crumb can say the record's name instead of the word "User":

```tsx
export const Route = createFileRoute("/_app/reports/$reportId")({
  component: RouteComponent,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      orpc.reports.detail.queryOptions({ input: { reportId: params.reportId } })
    ),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.name ?? "Report" }],
  }),
});
```

Things that bite:

- **`loader` has to be written above `head`.** TypeScript resolves the route options object in source order, and with `head` first it has not yet inferred what the loader returns, so `loaderData` widens to `never` and every property access on it fails to compile. This is the one place in the codebase where route options are deliberately not key-sorted — a dynamic route carries an `/* oxlint-disable sort-keys */` for it.
- **Always give the fallback a sensible label.** An id that resolves to nothing still renders a crumb; `loaderData?.name ?? "Report"` is the difference between a generic trail and one reading "undefined".
- **The loader is what makes the crumb possible, not an extra request.** `ensureQueryData` seeds the same cache entry the component's `useQuery` reads, so the page costs one fetch. The real trade is timing: navigation now waits for the record before it paints rather than flashing a skeleton, which is deliberate — a breadcrumb that arrives a beat after the page is a layout shift in the header.
- **The root route's title is the product name, not a crumb.** `__root.tsx` sets `title: "trumpet-pods"` as the fallback tab title; `AppBreadcrumbs` skips the root match so it never appears in the trail. Every child title overrides it in the tab.
- **`staticData.crumb` is gone.** It could not express a dynamic crumb, and keeping both would mean two places to name a screen.

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment

Operator-facing setup — running the images, the first account, proxies, optional services and recovery — is in [docs/self-hosting.md](docs/self-hosting.md). How the server boots is in [apps/server/README.md](apps/server/README.md).

### Docker Compose

- Target: web + server
- Config: `docker-compose.yml` (app Dockerfiles live in `apps/*/Dockerfile`)
- Build images: pnpm run docker:build
- Start: pnpm run docker:up
- Logs: pnpm run docker:logs
- Stop: pnpm run docker:down

Environment variables are read from each app's `.env` file (baked into web builds for public variables) and overridden in `docker-compose.yml` for container networking.

The stack mirrors production:

- **One published port.** Only the web container publishes one (`WEB_PORT`, container port 2600, because the unprivileged nginx image cannot bind 80). The API is reached through its proxy and needs no public hostname.
- **Two images, all non-root**, each with its own `HEALTHCHECK`. The server image is `pnpm deploy --prod` output plus the bundle — no tsx, drizzle-kit or workspace source.
- **The server migrates its own database on boot** in production (`apps/server/src/start.ts`): drizzle migrations, then pending post-migration scripts in the background. CI never connects to the database. The compose stack skips this because a local database is usually push-built; run `pnpm db:deploy` yourself.

### Releases and image tags

`release.yml` builds each image once per commit to `main` and tags it `sha-<7 chars>`, the only tag anything deploys by. Publishing a GitHub release `vX.Y.Z` runs `publish-version.yml`, which retags that commit's existing images — nothing is rebuilt — as `X.Y.Z`, `X.Y` and `latest` (and `X` from 1.0 on). A pre-release gets its exact version only.

The web image serves the SPA through nginx using `apps/web/nginx.conf.template`, which is rendered at container start so the CSP can name this deployment's storage origin — see [Security headers](#security-headers).

### The web image is environment-agnostic

`VITE_SERVER_URL` defaults to `/`, meaning "the origin that served this page". nginx forwards `/rpc` to `SERVER_UPSTREAM`, plus `/health/ready` for an outside uptime monitor, so the browser only ever talks to one origin. Nothing environment-specific is inlined at build time, which is what lets a single built image be promoted from staging to production rather than rebuilt per environment. `apps/web/vite.config.ts` proxies the same prefix so `pnpm dev` runs the same topology.

Two consequences worth knowing:

- **The API needs no public hostname.** It is reachable only through the web origin. `/api-reference` and the Prometheus metrics path are deliberately _not_ proxied, so they stay private, and `/api-reference` is not mounted at all when `NODE_ENV=production`.
- **`SERVER_UPSTREAM` goes through a resolver on purpose.** A hostname written literally into `proxy_pass` is resolved once at nginx startup and cached for the process's life, so recreating the API container would leave nginx posting at an address nothing answers on. The variable-plus-`resolver` form re-resolves per request.

For more details, see the guide on [Deploying with Docker Compose](https://www.better-t-stack.dev/docs/guides/docker).

## Git Hooks and Formatting

- Run checks: `pnpm run check`
- Dead code and dependencies: `pnpm knip` (unused, unlisted and unresolved dependencies, and unused exports). Lefthook runs it on pre-push and CI runs it in the `deps` job.

## Security headers

Both tiers set their own, because they serve different things and a header that suits one is wrong for the other.

**The API** (`apps/server/src/security-headers.ts`) runs Hono's `secureHeaders()` with two content security policies, chosen per request. Every JSON route gets `default-src 'none'` — a browser never renders those responses, so the policy can be the strictest CSP can express. `/api-reference` gets a looser one, because the Scalar docs UI is real HTML that pulls a bundle from jsDelivr and runs an inline config script.

Two departures from Hono's defaults are worth knowing:

- **`Cross-Origin-Resource-Policy` is `cross-origin`, not the default `same-origin`.** This server exists to be read from another origin — the web app on `CORS_ORIGIN`. Leaving the default would be a same-origin restriction sitting directly behind a CORS config that exists to allow the opposite.
- **`X-Frame-Options` is `DENY` rather than `SAMEORIGIN`.** Nothing here is ever meant to be framed, including by itself.

`Strict-Transport-Security` keeps Hono's default. Browsers ignore it entirely over plain HTTP, so it costs local development nothing and needs no `NODE_ENV` branch.

**The web app** is served by nginx from `apps/web/nginx.conf.template`, rendered at container start by the nginx image's own envsubst step. It is a template for one reason: the SPA's `connect-src` has to name the origins it talks to, and those are deployment-specific. `CSP_CONNECT_SRC` carries them.

Two things that bite:

- **`connect-src` needs the object storage endpoint.** The API is same-origin — `'self'` covers it — but uploads go straight from the browser to a presigned URL, so omitting the bucket breaks uploads and nothing else, a confusing way to find out. `docker-compose.yml` sets it for the local stack.
- **Unsetting `CSP_CONNECT_SRC` is not the same as setting it empty.** envsubst only substitutes variables that exist in the environment, so an unset one stays literal, and nginx then reads `$CSP_CONNECT_SRC` as one of its own variables and refuses to start: `unknown "csp_connect_src" variable`. The Dockerfile's `ENV CSP_CONNECT_SRC=""` is what keeps that from happening. Failing loudly at boot beats shipping a policy with a hole in it.

nginx sends the same `Strict-Transport-Security` value as the API (`max-age=15552000; includeSubDomains`), so the origin has one policy whether a response came from nginx or was proxied. Mind `includeSubDomains` before serving on an apex domain whose subdomains are not all on HTTPS: it is slow and painful to undo.

### CSRF

`/rpc` requires an `x-csrf-token` header: oRPC's `SimpleCsrfProtectionHandlerPlugin` refuses any call without it, which a cross-site page can only send after a CORS preflight that `CORS_ORIGIN` refuses. Every `RPCLink` — web and tests — needs `SimpleCsrfProtectionLinkPlugin`.

## Object storage

Uploads go straight from the client to the bucket. `storage.createUpload` reserves a `file` row and returns a presigned `PUT`; the client uploads the bytes itself; `storage.confirmUpload` then verifies the object landed and records the real size and checksum. Bytes never pass through the API server, so large files cost it nothing.

Any S3-compatible backend works — MinIO locally, AWS S3 / Cloudflare R2 / Tigris in production — by changing env vars only:

| Variable | Notes |
| --- | --- |
| `S3_BUCKET` | Uploads are disabled unless this and both credentials are set |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` |  |
| `S3_REGION` | Defaults to `auto` (right for R2; use a real region on AWS) |
| `S3_ENDPOINT` | Server → bucket. Omit on real AWS S3 |
| `S3_PUBLIC_ENDPOINT` | Host baked into presigned URLs. Defaults to `S3_ENDPOINT` |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO, `false` for R2, irrelevant on AWS |
| `STORAGE_MAX_UPLOAD_BYTES` | Defaults to 25 MiB |

Start the local bucket with:

```sh
docker compose up -d minio minio-init
```

The MinIO console is at [http://localhost:5301](http://localhost:5301) (`minioadmin` / `minioadmin` by default).

Two things that bite:

- **`S3_ENDPOINT` and `S3_PUBLIC_ENDPOINT` are not the same thing.** A presigned URL bakes in the host it was signed against. Inside Compose the server reaches MinIO at `http://minio:9000`, but a URL with that host is useless to a browser — hence the separate public endpoint. Running the server outside Compose, both are `localhost`.
- **Bucket CORS is separate from the server's CORS config.** The presigned `PUT` goes to the bucket, so the _bucket_ is what must allow it. Locally that is MinIO's `MINIO_API_CORS_ALLOW_ORIGIN` (already set in `docker-compose.yml`); on S3 or R2 it is a one-time bucket CORS rule allowing `PUT` from your web origin and exposing `ETag`.

## Side effects after a mutation commits

`mutationProcedure` wraps handlers in `db.transaction(...)`, so a side effect called directly from a handler (purging a cache key, notifying another system) runs before the transaction has committed and may act on a write that then rolls back. Queue it with `context.afterCommit(...)` instead (see its docblock in `packages/api/src/procedures.ts`):

```ts
createWidget: mutationProcedure.handler(async ({ context, input }) => {
  const row = await context.db.insert(widget).values(/* ... */).returning();
  context.afterCommit(() => notifySubscribers(row));
  return row;
}),
```

## Project Structure

```
trumpet-pods/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono, ORPC)
├── packages/
│   ├── ui/          # Shared coss ui components and styles
│   ├── api/         # API layer / business logic
│   ├── db/          # Database schema & queries
│   ├── storage/     # S3-compatible object storage client
│   └── observability/ # evlog logging + PostHog drain
```

## Available Scripts

- `pnpm run dev`: Start the infrastructure containers, then the web application and the server in an mprocs pane each. The container logs are available as a pane but do not start on their own
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database (local iteration; use migrations for anything committed)
- `pnpm run db:generate`: Generate a new migration from schema changes
- `pnpm run db:migrate`: Run database migrations (structure only — use `db:deploy` for a working database)
- `pnpm run db:deploy`: Run migrations, then any pending post-migration scripts
- `pnpm run db:post-migrate`: Run pending post-migration scripts (see [Post-migration scripts](#post-migration-scripts))
- `pnpm run db:post-migrate:status`: Show which post-migration scripts have run
- `pnpm run db:post-migrate:new "<description>"`: Scaffold a new post-migration script
- `pnpm run db:purge -- --yes`: **Destructive.** Drop every table and row for a clean local reset (see [`packages/db/src/dev-scripts/purge/README.md`](packages/db/src/dev-scripts/purge/README.md))
- `pnpm run db:reset`: **Destructive.** Purge, then `db:deploy` — a fresh local database
- `pnpm run db:studio`: Open database studio UI
- `pnpm run check`: Run Vite+ format/lint checks (types are `check-types`)
- `pnpm run knip`: Report unused dependencies and exports
- `pnpm run lint`: Run Vite+ lint checks
- `pnpm run format`: Run Vite+ formatting
- `pnpm run staged`: Run Vite+ checks against staged files
- `pnpm run docker:build`: Build the Docker Compose images
- `pnpm run docker:up`: Build and start the Docker Compose stack
- `pnpm run docker:logs`: Tail logs from the Docker Compose stack
- `pnpm run docker:down`: Stop the Docker Compose stack
- `pnpm run secrets:setup`: Create local env files and generate safe local secrets; `--environment staging|production` runs the deployment wizard
- `pnpm run secrets:check`: Report local configuration, or verify a deployment environment against GitHub and Dokploy
- `pnpm run rename <new-name>`: Rename the template for a new project (see [Getting Started](#starting-a-new-project-from-this-template))

## Contributing

Setup, the test layout, and the conventions worth following are in [CONTRIBUTING.md](CONTRIBUTING.md). [AGENTS.md](AGENTS.md) is the condensed version, aimed at coding agents.

## License

MIT — see [LICENSE](LICENSE).
