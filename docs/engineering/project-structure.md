# Project structure

The monorepo uses pnpm workspaces and Turborepo. Architecture and rationale: [`../architecture/overview.md`](../architecture/overview.md), [ADR-0002](../architecture/adr/0002-monorepo-and-stack.md).

## Requirements

- **Node 24 LTS** (`.nvmrc`; `engines` in the root `package.json`).
- **pnpm 10** through Corepack (`packageManager` field): `corepack enable`.
- Docker, for images and (from issue #12) local services.

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
  db/           @globetrot/db           Drizzle schema + migrations
  api-client/   @globetrot/api-client   Typed client generated from OpenAPI
  tokens/       @globetrot/tokens       Design tokens
  ui/           @globetrot/ui           Web components + Storybook
  i18n/         @globetrot/i18n         ICU message catalogs
eslint.config.mjs   One flat ESLint config for the repo, including the architecture boundary rules
turbo.json          Task graph: build, dev, lint, typecheck, test
```

## Conventions

- **Internal packages ship TypeScript sources.** They have no build step: `exports` points to `src/index.ts`. Next.js compiles them via `transpilePackages`, and the api/worker bundles inline them with tsup. Add a package to `transpilePackages` in `apps/web/next.config.ts` when the web app starts importing it.
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
