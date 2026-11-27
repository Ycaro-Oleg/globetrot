# 0034. Hosting on Railway

- Status: Accepted (the owner decided on 2026-11-27); replaces the hosting part of [ADR-0002](0002-monorepo-and-stack.md)
- Date: 2026-11-27

## Context
ADR-0002 planned production on a Hetzner server running Coolify. Nothing had been deployed when the owner prepared the launch, and the priority became the fastest path to a live, sellable product that one person can run without looking after a server: operating-system updates, Docker, Coolify upgrades, firewall rules and database backups would all be the owner's job on Hetzner.

The three images (`apps/web`, `apps/api`, `apps/worker`) already build from the repository root with their own Dockerfiles, the API ships a migration command, and every setting comes from the environment ([configuration](../../engineering/configuration.md)), so any container platform can run them.

## Decision
- **Production runs on Railway**, in one project and one region (US East, the closest to Brazil): the `web`, `api` and `worker` services built from `main` with their Dockerfiles (`RAILWAY_DOCKERFILE_PATH`), PostgreSQL 17 with PostGIS on a volume, and a Railway Bucket (S3-compatible) for photos.
- **Only `web` is public**, on the owner's domain. The API is reached over Railway's private network (`API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000`), so [ADR-0010](0010-web-proxies-the-api.md) holds unchanged.
- **The API's pre-deploy command is `node dist/migrate.js`**, so migrations run before each new version starts, as before.
- **Secrets live only in Railway's service variables.** `NEXT_PUBLIC_*` values are build arguments of the web image (Railway passes service variables to the Docker build).
- **Deploys follow `main`**: a release merged to `main` deploys; `develop` never does.
- The steps are in the [launch runbook](../../engineering/launch-runbook.md).

## Alternatives considered
- **Hetzner + Coolify (ADR-0002):** cheaper per month (about €8 to €15 against about US$15 to US$30 at launch), but half a day to set up and an ongoing maintenance job for the owner. Worth revisiting if the Railway bill passes about US$100 a month.
- **Separate managed providers** (a managed Postgres, Cloudflare R2, a container host): more accounts and keys for no gain at this size.

## Consequences
- The client address used by the rate limits depends on Railway's edge replacing a client-supplied `X-Forwarded-For` ([trust model](../authentication.md#which-client-address-counts-trust-model)). Railway's forum answers disagree on whether it does, so the runbook has a launch check that proves it on the real domain.
- Railway does not back up buckets; photos have no second copy until one is added. The database volume needs its daily backups switched on and a restore tested before launch.
- The region is in the United States, so Brazilian visitors see about 120 ms of network latency; the pages are server-rendered and cached, so this is acceptable at launch.
- No code changed: the Dockerfiles, settings and health checks were already platform-neutral. The web Dockerfile was fixed the same day to pass every `NEXT_PUBLIC_*` setting to the build.
