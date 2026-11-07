# Local development

One command starts the services the apps need, close to the eventual Hetzner + Coolify setup. Monorepo layout and commands: [`project-structure.md`](project-structure.md).

## Requirements

- **Node 24 LTS** (`.nvmrc`) and **pnpm 10** via Corepack (`corepack enable`).
- **Docker** with Compose v2+ (Docker Desktop, or Docker Engine in WSL2 / Linux / macOS).
- `curl` ≥ 7.75 and `bash`. Both are only used by `pnpm services:check`.

> No Node 24 on the host? Run any pnpm command inside the official image:
> `docker run --rm -it -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/repo" -w /repo node:24-bookworm bash -c "corepack enable --install-directory /tmp/bin && PATH=/tmp/bin:\$PATH pnpm <command>"`

## First run

```bash
cp .env.example .env      # local-only defaults, git-ignored
pnpm install
pnpm services:up          # start Postgres, object storage and Mailpit, wait until healthy
pnpm services:check       # verify everything (DB extensions, S3 round trip, SMTP)
pnpm --filter @globetrot/db migrate   # create or upgrade the schema (extensions and the auth tables today, more as features land)
pnpm dev                  # web :3000, api :4000 (/health, /api/auth/*), worker
```

## Services (`compose.yaml`)

| Service | What | Host port (`.env`) | Notes |
|---|---|---|---|
| `postgres` | PostgreSQL 17 + PostGIS 3.7 | `POSTGRES_PORT=5455` | `postgis`, `pg_trgm` and `unaccent` are created on first start (`infra/postgres/init/`). Use `DATABASE_URL` |
| `storage` | S3-compatible object storage (SeaweedFS) | `S3_PORT=8333` | Stands in for Hetzner Object Storage. Use path-style URLs (`S3_FORCE_PATH_STYLE=true`), region `us-east-1` |
| `storage-init` | One-shot | — | Creates `S3_BUCKET` (idempotent), then exits |
| `mailpit` | Catches all outgoing email | `SMTP_PORT=1025`, UI `MAILPIT_UI_PORT=8025` | Open http://localhost:8025 to read emails |

- Port defaults avoid common clashes. 5455 is used because another Postgres often runs on 5432. Change any port in `.env` and keep `DATABASE_URL`/`S3_ENDPOINT` in sync.
- The credentials in `.env.example` are **local-only defaults, not secrets**. Real credentials live only in Coolify (M11) and never in the repository.
- **Why SeaweedFS, not MinIO:** the official MinIO images are no longer published on Docker Hub. The apps talk plain S3 through a storage port, so the local backend can change without touching code.

## Commands

| Command | Effect |
|---|---|
| `pnpm services:up` | `docker compose up -d --wait`, then wait for the bucket to be created |
| `pnpm services:check` | Health report: Postgres + extensions + search smoke query, S3 health, bucket, signed PUT/GET/DELETE, 403 on wrong credentials, SMTP delivery into Mailpit |
| `pnpm services:logs` | Follow all service logs |
| `pnpm services:down` | Stop. Data stays in the named volumes `globetrot_postgres-data` and `globetrot_storage-data` |
| `pnpm services:reset` | Stop and **delete all local data**. The init scripts run again on the next `up` |

## Database

| Command | Effect |
|---|---|
| `pnpm --filter @globetrot/db migrate` | Apply pending migrations to `DATABASE_URL`. Running it again changes nothing |
| `pnpm --filter @globetrot/db reset` | Drop and recreate the local database, then migrate. Refuses non-local hosts and `NODE_ENV=production` |
| `pnpm --filter @globetrot/db generate` | Generate a migration from `src/schema` (add `--custom --name=<what>` through `drizzle-kit` for hand-written SQL) |
| `pnpm test:int` | Integration tests: each one creates and drops its own `globetrot_test_*` database, so your data is safe |

Conventions and the migration rules are in [`data-model.md`](../architecture/data-model.md).

## How the apps get configuration

- `apps/api` and `apps/worker` start with `tsx --env-file-if-exists=../../.env` in `pnpm dev`, so the root `.env` is loaded when present. Deployed containers receive environment variables from Coolify instead.
- `apps/web` (Next.js) reads `apps/web/.env*` files, not the root `.env`. Its one server-side variable is `API_INTERNAL_URL` (where `/api/auth/*` is proxied; default `http://localhost:4000`, so `pnpm dev` needs nothing).
- The API reads its auth settings (secret, public URL, trusted origins, session and rate-limit knobs) from the environment. Without `BETTER_AUTH_SECRET` it uses the public development secret and warns; with `NODE_ENV=production` it refuses to start. Full table: [`authentication.md`](../architecture/authentication.md).
- Open http://localhost:3000 and call `/api/auth/*` there, not on :4000: the browser always goes through the web origin so the session cookie is first-party.
- Storage and email adapters arrive with their features.

## Troubleshooting

- **Port already allocated:** change the port in `.env` (and the matching URL), then `pnpm services:up`.
- **Extensions missing:** the init SQL only runs on a fresh volume. Run `pnpm services:reset`.
- **WSL2:** keep the repository on the Linux filesystem (`~/…`), not under `/mnt/c`, for fast installs and file watching.
