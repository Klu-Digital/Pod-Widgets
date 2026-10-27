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
      # The address people open the app at.
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

Put the database password into a `.env` beside it, then start the stack:

```bash
printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 16)" > .env
docker compose up -d --wait
```

- **The server migrates the database every time it boots** — drizzle migrations, pg-boss's schema, then pending post-migration scripts — so nothing else needs running, and updating is `docker compose pull && docker compose up -d`. Details in [`apps/server/README.md`](../apps/server/README.md#boot-and-migrations).
- **Pin a version for anything you rely on.** Publishing a GitHub release `vX.Y.Z` runs `publish-version.yml`, which retags that commit's images as `X.Y.Z`, `X.Y` and `latest` (and `X` from 1.0). `main` follows the latest commit and `sha-<7 chars>` is a single build that never moves. Set `APP_VERSION` so all three images move together.
- **GHCR packages are private by default.** Make them public, or `docker login ghcr.io` on the host with a token that can read packages.
- **Use HTTPS anywhere but localhost.** On a real domain, put a TLS-terminating proxy in front of `web`, set `CORS_ORIGIN` to the `https://` address, and raise `TRUSTED_PROXY_HOPS` to `2`.

## Build it from source

```bash
pnpm install && pnpm secrets:setup
docker compose up -d --wait postgres && pnpm db:deploy
pnpm docker:up
```

The compose stack mirrors production — one published port (`WEB_PORT`, container port 2600, because the unprivileged nginx image cannot bind 80), three non-root images each with its own `HEALTHCHECK` — except that it skips migrate-on-boot, because a local database is usually push-built. Hence `pnpm db:deploy` above.

## Deploy to a VPS

`deploy/docker-compose.vps.yml` builds the images from source and runs Caddy, web, server, workers and Postgres on one host. It is for a throwaway box: there is no auth, so **anyone with the URL can read and edit everything**. Use throwaway data only.

Prerequisites: a Linux host with Docker (Compose v2) and ports 80 and 443 open.

```bash
git clone <repo> && cd <repo>
cp deploy/.env.vps.example deploy/.env.vps   # set POSTGRES_PASSWORD and PUBLIC_ORIGIN
docker compose -f deploy/docker-compose.vps.yml --env-file deploy/.env.vps up -d --build --wait
```

- **TLS.** `SITE_ADDRESS=:80` serves plain HTTP on the host's IP. For a domain, point its DNS at the host, set `SITE_ADDRESS=app.example.com` and `PUBLIC_ORIGIN=https://app.example.com`, and Caddy gets a certificate on its own. `PUBLIC_ORIGIN` becomes `CORS_ORIGIN`, so it must match the browser's address exactly.
- **Exposed.** Only Caddy, on `HTTP_PORT` and `HTTPS_PORT`. Web, server, workers and Postgres publish nothing.
- **Migrations.** The server applies them on boot, so run one replica. `TRUSTED_PROXY_HOPS` is fixed at `2` (Caddy, then nginx).
- **Uploads, later.** Nothing uses object storage yet. When it does, uncomment the uploads block in `deploy/.env.vps` and add `--profile uploads`. That starts MinIO and publishes its S3 API on `MINIO_PORT`. Keep `S3_PUBLIC_ENDPOINT`, `CSP_CONNECT_SRC` and `PUBLIC_ORIGIN` consistent: the first two name the MinIO address the browser reaches, and `PUBLIC_ORIGIN` is also MinIO's CORS allow-origin.

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
