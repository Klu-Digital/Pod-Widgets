# AGENTS.md

A fullstack TypeScript template: React/TanStack Router web, Hono + oRPC API, Postgres/Drizzle. There is no auth: the app is public and single-tenant. pnpm workspace, `@trumpet-pods/*` package scope. `pnpm rename <new-name>` rewrites the scope, the Compose project and the database for a new project. It sends no email. The reasoning behind the decisions that surprise people is in [docs/adr/](docs/adr/).

## Layout

```
apps/web       React SPA (TanStack Router, Tailwind, coss ui via packages/ui)
apps/server    Hono HTTP server — mounts oRPC, metrics
packages/api   oRPC procedures, middleware, routers. The business logic
packages/db    Drizzle schema, migrations, post-migration scripts, dev scripts
packages/env   Validated env schemas (server/web)
packages/storage        S3-compatible presigned uploads
packages/observability  evlog logging + PostHog drain
packages/testing        Test harness: per-worker Postgres helpers
packages/ui    Shared coss ui primitives (Base UI + Tailwind)
```

## Commands

```bash
pnpm dev                # everything; also dev:web / dev:server
pnpm check              # ultracite check — oxlint + oxfmt with the Ultracite preset
pnpm fix                # ultracite fix — autofix lint + format (pre-commit runs this on staged files)
pnpm check-types        # tsc across the workspace — NOT part of `check`, run it separately
pnpm db:deploy          # migrations + post-migration scripts
pnpm db:generate        # new migration from a schema edit
pnpm db:purge -- --yes  # DESTRUCTIVE local reset
```

`pnpm db:migrate` alone skips the post-migration scripts, so reference rows such as the default page are missing. Use `db:deploy`.

Ports are deliberately not upstream defaults: server 1900, web 2600, **postgres 4400**, minio 5300/5301.

## Tests

The filename routes the test. Three vitest projects:

- `*.db.test.ts` → **db** project: real Postgres via testcontainers. Each worker gets its own database cloned from a migrated template, truncated between tests.
- `apps/web/**/*.test.{ts,tsx}` → **web** project: jsdom.
- everything else `*.test.ts` → **unit** project: node, no I/O.

Run one file: `pnpm exec vp test run --project unit path/to/file.test.ts`.

`@trumpet-pods/env/server` freezes its config at import, so `vi.stubEnv` does not work on it. Mock the module instead — `apps/server/src/metrics.test.ts` is the pattern.

## Invariants worth knowing before editing

These are the ones that cost real time to rediscover. [docs/reference.md](docs/reference.md) carries the fuller writeups under each feature's "things that bite".

**Side effects inside a mutation must go through `context.afterCommit()`.** `mutationProcedure` wraps handlers in `db.transaction(...)`, so a side effect called inline (a cache purge, a notification) acts on a write the transaction may still roll back. The `.use(afterCommit).use(transaction)` order in `packages/api/src/procedures.ts` is load-bearing — reversing it silently reintroduces the bug.

**The SPA and the API share one origin.** `VITE_SERVER_URL` defaults to `/`, and nginx in the web image proxies `/rpc` to `SERVER_UPSTREAM`. That is what keeps the web image environment-agnostic (one build promotes staging → production). A new public route needs its own nginx `location` and Vite proxy entry. Two things follow: the API needs no public hostname, and the nginx upstream goes through a `resolver` with a variable because a literal hostname in `proxy_pass` is resolved once at startup and cached for the life of the process.

**A route's `head()` title is its breadcrumb.** `AppBreadcrumbs` builds the trail from the matched routes' `head()` meta titles, so naming a screen for the tab names it in the breadcrumb too, and there is no second table of paths to keep in sync. A route with no title contributes no crumb; the root's title is the product name and is skipped. For a dynamic segment, `head({ loaderData })` reads the record — which means the route needs a `loader`, and **`loader` must be written above `head`** or TypeScript infers `loaderData` as `never`. That ordering is why such routes carry an `oxlint-disable sort-keys`.

**`/rpc` requires an `x-csrf-token` header.** oRPC's `SimpleCsrfProtectionHandlerPlugin` refuses calls without it, so a cross-site page cannot call it without a preflight `CORS_ORIGIN` refuses. Every `RPCLink` — web and tests — needs `SimpleCsrfProtectionLinkPlugin`, or every call is a 403.

**The runtime images carry production dependencies only.** The server image is `pnpm deploy --prod` output plus the bundle, so there is no tsx, drizzle-kit or workspace source in them. The server therefore bundles what it needs to run operations: `apps/server/src/start.ts`, the image's entry, applies migrations on boot and then runs pending post-migration scripts, which `apps/server/tsdown.config.ts` bundles in statically. CI never touches the database. A new operational command gets bundled the same way, not run through tsx. Every migration must stay backward compatible with the previous image, which keeps running against the new schema during a rolling deploy.

**Presigned uploads bypass the server's CORS config.** The browser PUTs straight to the bucket, so the _bucket_ must allow the web origin, and the SPA's CSP `connect-src` must include the storage endpoint (`CSP_CONNECT_SRC` in `apps/web/nginx.conf.template`). `S3_ENDPOINT` and `S3_PUBLIC_ENDPOINT` are not the same thing.

## Writing code here

**Procedures.** Two rungs in `packages/api/src/procedures.ts`: `publicProcedure` for reads and `mutationProcedure` (`publicProcedure` plus `afterCommit` and the transaction) for writes. Feature-scoped files live beside their feature (`packages/api/src/jobs/jobs.router.ts`).

**Routers are transport** ([ADR 0005](docs/adr/0005-routers-are-transport.md)). A `*.router.ts` holds input schemas, the procedure rung and a call into the feature's `*.queries.ts` (reads) or `*.commands.ts` (writes) — plain `(db, …)` functions that scripts can import too. Only `routers/index.ts` may import a router (tests excepted); oxlint's `no-restricted-imports` enforces it. Cross-feature helpers live in `packages/api/src/shared/`: `errors.ts` has `notFound(entity)` and `domainErrors`, the codes whose messages are written for people, declared on the base builder so they reach the web as defined errors — throw INTERNAL_SERVER_ERROR for anything whose message is not.

**Web errors toast once, from the `QueryClient`.** `apps/web/src/utils/orpc.ts` toasts failed queries and mutations through `errorMessage`, which shows only defined errors' messages; a screen that shows the failure inline sets `meta: { suppressErrorToast: true }` instead of its own `onError`. Defined errors are never retried. Type procedure results with `RouterOutputs`, not `typeof client`; component tests mock `@/utils/client`.

**Logging.** Reach for `log` from `@trumpet-pods/observability`, never `console`. Every call carries an `action` — a dotted, snake_cased event name that is the thing you will later grep and alert on (`server.migrate_failed`, `health.db_unreachable`, `aftercommit.failed`). Spread `parseError(error)` into the payload rather than stringifying the error yourself.

**Styling.** The `shadcn/*` oxlint rules are errors in app code: no raw colors, no inline styles, no arbitrary values, no unknown classes, and class names must be static strings (no `` `text-${tone}-500` ``). Colors come from the theme in `packages/ui/src/styles/globals.css`. `layout` is the one allowed arbitrary-value escape. One exemption is configured deliberately in `oxlint.config.ts`: `packages/ui/src/**` may style itself because it _is_ the design system. Import primitives as `@trumpet-pods/ui/components/button`; add more with `npx shadcn@latest add @coss/<name> -c packages/ui`.

**Lint deltas from the Ultracite preset.** `no-await-in-loop` is off — plenty of loops here are deliberately sequential (ordered migrations, retry backoff, cursor walks) and the rule's suggested fix is a bug. `react/no-unstable-nested-components` allows render props. Everything else is the preset, and `pnpm fix` autofixes most of it.

**Comments.** One line, naming the bug the line prevents. [TERSE.md](TERSE.md) has the budget, what earns more than a line, and the directive and template-literal gotchas.

**Columns.** Instants come from `packages/db/src/schema/columns.ts`: `timestamptz()` (never bare `timestamp()`) and `timestamps()` for the usual `createdAt`/`updatedAt` pair ([ADR 0003](docs/adr/0003-timestamptz-for-instants.md)). Status and type columns are text plus a CHECK built with `oneOf()`, not a pg enum.

**Migrations and backfills.** `pnpm db:push` is for local iteration only; anything committed gets a migration. Generate it with `pnpm db:generate --name <snake_case_description>` so the folder name says what it does. Start from what `drizzle-kit generate` wrote; hand-edit the SQL only when it cannot express the change safely (a `USING` cast, composite foreign keys added `NOT VALID` then `VALIDATE`d), and validate a hand-edited migration on a scratch database. **Backfills never go in a migration**: data backfills and reference rows go in `packages/db/src/post-migration-scripts/`, so use `db:deploy`, never `db:migrate` alone.

**Generated files stay untouched:** `apps/web/src/routeTree.gen.ts` and migration `snapshot.json`.

**Env vars.** Adding a server env var means adding it to the matching `.env.example` too — `packages/env/src/env-example.test.ts` fails otherwise. Everything the server reads is validated at startup by `packages/env/src/server.ts`, so a missing variable is a boot error naming it, not a mystery at the first request.

## Ultracite code standards

This project uses **Ultracite**, a zero-config preset over Oxlint + Oxfmt. Most issues are automatically fixable — run `pnpm fix` before committing, and `pnpm check` to see what is outstanding. (`pnpm exec ultracite doctor` diagnoses the setup itself.) The repo's deltas from the preset are in [Writing code here](#writing-code-here); everything below is the preset's baseline.

Write code that is **accessible, performant, type-safe, and maintainable**. Favor clarity and explicit intent over brevity.

### Type safety and explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Lean on TypeScript's type narrowing instead of type assertions
- Extract magic numbers into constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async and promises

- Always `await` promises in async functions — use the return value
- Use `async/await` syntax instead of promise chains for readability
- Handle errors in async code with try-catch blocks
- Keep async functions out of Promise executors

### React and JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Define components at module scope, not inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

**React 19+:** use ref as a prop instead of `React.forwardRef`.

### Error handling and debugging

- Keep `console.log`, `debugger` and `alert` out of committed code — reach for the logger instead, as [Writing code here](#writing-code-here) describes
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully — catching only to rethrow adds nothing
- Prefer early returns over nested conditionals for error cases

### Code organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Reach for `dangerouslySetInnerHTML` only when there is genuinely no alternative
- Keep `eval()` and direct `document.cookie` assignment out of the codebase
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)

### Testing

- Write assertions inside `it()` or `test()` blocks
- Use async/await in async tests rather than done callbacks
- Keep `.only` and `.skip` out of committed code
- Keep test suites reasonably flat — avoid excessive `describe` nesting

### What the linter cannot check

Oxlint catches most of the above automatically. Spend your own attention on:

1. **Business logic correctness** — the linter cannot validate an algorithm
2. **Meaningful naming** — for functions, variables, and types
3. **Architecture decisions** — component structure, data flow, API design
4. **Edge cases** — boundary conditions and error states
5. **User experience** — accessibility, performance, usability
6. **Documentation** — comments for subtle logic, per [TERSE.md](TERSE.md)

## Fuller writeups

Each of these has a README section carrying the reasoning the summary above compresses:

- [Object storage](docs/reference.md#object-storage), [Side effects after a mutation commits](docs/reference.md#side-effects-after-a-mutation-commits)
- [Security headers](docs/reference.md#security-headers), [The web image is environment-agnostic](docs/reference.md#the-web-image-is-environment-agnostic)
- [Page titles and breadcrumbs](docs/reference.md#page-titles-and-breadcrumbs), [UI Customization](docs/reference.md#ui-customization)
- [Post-migration scripts](docs/reference.md#post-migration-scripts) and its [authoring guide](packages/db/src/dev-scripts/post-migrate/README.md)
- [docs/self-hosting.md](docs/self-hosting.md) — operator view: images, proxies, optional services
- [apps/server/README.md](apps/server/README.md) — boot migrations, health and shutdown
- [docs/adr/](docs/adr/) — the decisions behind the invariants above
- [CONTRIBUTING.md](CONTRIBUTING.md) — first-run setup, env files, the services to bring up
