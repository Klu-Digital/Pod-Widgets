# Self-hosting

What an operator needs: running the stack, the first account, proxies, the optional services, and looking after accounts. How the code works is in the READMEs next to it; this page links to them where the reasoning matters.

## Requirements

|  | Needs |
| --- | --- |
| **Required** | Docker and Postgres 18 (every id defaults to the native `uuidv7()`). Node 26 and pnpm 10+ only to build from source |
| **Optional** | Redis, an S3-compatible bucket, PostHog |

## Run the published images

`release.yml` pushes three images to GHCR on every commit to `main`: `ghcr.io/<owner>/<repo>/web`, `/server` and `/workers`. Point a compose file at them:

```yaml
services:
  web:
    image: ghcr.io/<owner>/<repo>/web:${APP_VERSION:-latest}
    ports:
      - "2600:2600"
    depends_on:
      server:
        condition: service_healthy
    restart: unless-stopped

  server:
    image: ghcr.io/<owner>/<repo>/server:${APP_VERSION:-latest}
    environment:
      DATABASE_URL: postgresql://app:${POSTGRES_PASSWORD}@postgres:5432/app
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      # The address people open the app at.
      BETTER_AUTH_URL: http://localhost:2600
      CORS_ORIGIN: http://localhost:2600
      # The web image's nginx sits in front of the server.
      TRUSTED_PROXY_HOPS: 1
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  workers:
    image: ghcr.io/<owner>/<repo>/workers:${APP_VERSION:-latest}
    environment:
      DATABASE_URL: postgresql://app:${POSTGRES_PASSWORD}@postgres:5432/app
    depends_on:
      server:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:18
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

Generate the two secrets into a `.env` beside it, then start the stack:

```bash
printf 'POSTGRES_PASSWORD=%s\nBETTER_AUTH_SECRET=%s\n' "$(openssl rand -hex 16)" "$(openssl rand -base64 32)" > .env
docker compose up -d --wait
```

- **The server migrates the database every time it boots** — drizzle migrations, pg-boss's schema, then pending post-migration scripts — so nothing else needs running, and updating is `docker compose pull && docker compose up -d`. Details in [`apps/server/README.md`](../apps/server/README.md#boot-and-migrations).
- **Pin a version for anything you rely on.** Publishing a GitHub release `vX.Y.Z` runs `publish-version.yml`, which retags that commit's images as `X.Y.Z`, `X.Y` and `latest` (and `X` from 1.0). `main` follows the latest commit and `sha-<7 chars>` is a single build that never moves. Set `APP_VERSION` so all three images move together.
- **GHCR packages are private by default.** Make them public, or `docker login ghcr.io` on the host with a token that can read packages.
- **Use HTTPS anywhere but localhost.** The images run in production mode, so the session cookie is `Secure`; over plain HTTP browsers only keep it on `localhost`, and Safari not even there. Sign-in then fails silently. On a real domain, put a TLS-terminating proxy in front of `web`, set `BETTER_AUTH_URL` and `CORS_ORIGIN` to the `https://` address, and raise `TRUSTED_PROXY_HOPS` to `2`.
- **The admin CLI is in the server image**: `docker compose exec server pnpm admin:reset-password you@example.com`.

## Build it from source

```bash
pnpm install && pnpm secrets:setup
docker compose up -d --wait postgres && pnpm db:deploy
pnpm docker:up
```

The compose stack mirrors production — one published port (`WEB_PORT`, container port 2600, because the unprivileged nginx image cannot bind 80), three non-root images each with its own `HEALTHCHECK` — except that it skips migrate-on-boot, because a local database is usually push-built. Hence `pnpm db:deploy` above.

## The first account

**Sign-up is closed by default.** The first account on an empty database bootstraps the instance and becomes platform admin. Create yours before the instance is reachable by anyone else: whoever signs up first owns it. After that, new accounts come only from invite links. Set `ALLOW_SIGNUP=true` on the server to open sign-up.

## Deployment configuration

```bash
pnpm secrets:setup --environment staging
pnpm secrets:check --environment staging
```

The wizard decides which values are GitHub Secrets, GitHub Variables or Dokploy runtime variables, shows the destinations before it writes anything, then applies and verifies. `DATABASE_URL` goes to the Dokploy applications only: CI never connects to the database. CI runs on [Blacksmith](https://www.blacksmith.sh/) runners for the heavy jobs, so the GitHub organization needs the Blacksmith app installed.

## Putting it behind a proxy

| Variable | Notes |
| --- | --- |
| `TRUSTED_PROXY_HOPS` | How many proxies sit in front of the server: `1` for the web image's nginx alone, `2` with Traefik or a load balancer in front of that. Too low and every caller shares a proxy's address; too high and callers can pick their own. Defaults to `0`. [Why](../apps/server/README.md#client-ip-and-trusted_proxy_hops) |
| `SERVER_UPSTREAM` | Where the web image's nginx forwards API traffic |
| `CSP_CONNECT_SRC` | Extra origins for the SPA's `connect-src` (and `img-src`). **Must include your object storage endpoint**, or uploads break and nothing else does |

Both tiers send `Strict-Transport-Security` with `includeSubDomains`. Think twice before serving on an apex domain whose subdomains are not all on HTTPS: it is slow and painful to undo. `/health/ready` is proxied through the web origin for an uptime monitor; `/` on the web origin is nginx's own 200 even when the API is down.

## Object storage and Redis

The variables are in the root README's [Object storage](../README.md#object-storage) and [Redis](../README.md#redis) sections. Set the storage variables on the workers too, so a job can read what a client uploaded. With `REDIS_URL` unset, rate limits count in each process's memory and the cache is a pass-through; alert on `redis.error` and `ratelimit.fallback`.

## Accounts, recovery and invitations

Nothing is ever emailed ([ADR 0001](adr/0001-no-email-admin-driven-recovery.md)). Recovery is admin-driven, with shell access to the server as the root of trust.

- **Invitations are links.** An invitation's email is only a label. The inviter copies the link from organization settings and sends it themselves, and whoever holds it can join with the invited role until it expires or is cancelled. Each link admits one new account; anyone else holding it can still join with an existing account.
- **A platform admin resets passwords** from `/admin/users/<id>` → Password. That creates a one-time link, valid for 24 hours, which the admin hands over out of band. Completing it signs the user out everywhere.
- **A locked-out lone admin uses the CLI.** `pnpm admin:reset-password <email>` prompts for a new password (empty generates one) and revokes the account's sessions. `pnpm admin:grant <email>` makes an existing account platform admin. Both work locally or inside the server container, where they run a bundled copy.
- **Forgot password** still works as a fallback for whoever runs the server: the reset link is written to the server's raw stdout (`docker logs`), never to the structured logger.
