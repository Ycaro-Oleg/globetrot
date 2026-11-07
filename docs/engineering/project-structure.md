# Project structure

The monorepo uses pnpm workspaces and Turborepo. Architecture and rationale: [`../architecture/overview.md`](../architecture/overview.md), [ADR-0002](../architecture/adr/0002-monorepo-and-stack.md).

## Requirements

- **Node 24 LTS** (`.nvmrc`; `engines` in the root `package.json`).
- **pnpm 10** through Corepack (`packageManager` field): `corepack enable`.
- Docker, for images and local services (see [`local-development.md`](local-development.md)).

## Layout

```
apps/
  web/      @globetrot/web      Next.js 16 App Router (marketing + app). Standalone output for Docker
  api/      @globetrot/api      Hono HTTP adapter. Bundled with tsup into dist/
  worker/   @globetrot/worker   Background jobs (pg-boss later). Bundled with tsup into dist/
packages/
  config/       @globetrot/config       Shared tsconfig presets (base, library, nextjs)
  domain/       @globetrot/domain       Pure domain rules. Relative imports only (lint-enforced)
  application/  @globetrot/application  Commands/queries + ports. No UI/HTTP/DB framework imports (lint-enforced)
  db/           @globetrot/db           Drizzle schema, SQL migrations, connection and test-database helpers (data-model.md)
  api-client/   @globetrot/api-client   Typed client generated from OpenAPI
  tokens/       @globetrot/tokens       Design tokens
  ui/           @globetrot/ui           Web components + Storybook
  i18n/         @globetrot/i18n         ICU message catalogs
eslint.config.mjs   One flat ESLint config for the repo, including the architecture boundary rules
turbo.json          Task graph: build, dev, lint, typecheck, test
compose.yaml        Local services (Postgres + PostGIS, S3 storage, Mailpit). See local-development.md
infra/              Local service init scripts and the services check
```

## Conventions

- **Internal packages generally ship TypeScript sources:** `exports` points to `src/index.ts`. The tokens package additionally builds its CSS and DTCG theme artifacts; run its build before using those artifacts. Next.js compiles them via `transpilePackages`, and the api/worker bundles inline them with tsup. Add a package to `transpilePackages` in `apps/web/next.config.ts` when the web app starts importing it.
- **Dependency direction:** `apps/*` → `application` → `domain`. `domain` imports nothing. Adapters (db, HTTP, AI, Stripe, …) depend on `application` ports, never the reverse.
- Every package exposes the same scripts: `lint`, `typecheck`, `test`. Apps add `dev`, `build`, `start`.
- **Tests:** Vitest, colocated as `*.test.ts(x)` next to the code.
- **Versions** are pinned exactly in `package.json`. TypeScript stays on 6.0.x until typescript-eslint supports 7.x.
- **Formatting:** Prettier for code and config. Markdown and `.github/` templates are formatted by hand.

## Commands (repo root)

| Command | What |
|---|---|
| `pnpm install` | Install all workspaces |
| `pnpm dev` | Run all apps in watch mode (web :3000, api :4000) |
| `pnpm build` | Build the apps |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Checks across all workspaces (Turborepo-cached) |
| `pnpm test:int` | Integration tests against the local PostgreSQL (run `pnpm services:up` first). Not part of `pnpm test` |
| `pnpm --filter @globetrot/db migrate \| reset \| generate` | Apply migrations, rebuild the local database, generate a migration from the schema |
| `pnpm api:generate` | After changing an API route or schema: rewrite `packages/api-client/openapi.json` and the generated client types (two tests fail while they are stale) |
| `pnpm --filter @globetrot/api <script>` | Run a script in one workspace |
| `pnpm format` / `pnpm format:check` | Prettier |

## Docker images

Build from the repository root (each Dockerfile runs `turbo prune` for its app):

```bash
docker build -f apps/web/Dockerfile -t globetrot-web .
docker build -f apps/api/Dockerfile -t globetrot-api .
docker build -f apps/worker/Dockerfile -t globetrot-worker .
```

- `web` serves on `PORT` (default 3000). `api` serves on `PORT` (default 4000), with health at `/health`.
- All images run as the unprivileged `node` user and stop cleanly on SIGTERM.

## Adding a package

1. Create `packages/<name>/` with `package.json` (`"name": "@globetrot/<name>"`, `exports` → `./src/index.ts`, the standard scripts, and `@globetrot/config` as a devDependency), plus `tsconfig.json` extending a preset.
2. Add a smoke test.
3. Document the package in this file. If it introduces a new architectural boundary, add a lint rule in `eslint.config.mjs`.
