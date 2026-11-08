# Project structure

The monorepo uses pnpm workspaces and Turborepo. Architecture and rationale: [`../architecture/overview.md`](../architecture/overview.md), [ADR-0002](../architecture/adr/0002-monorepo-and-stack.md).

## Requirements

- **Node 24 LTS** (`.nvmrc`; `engines` in the root `package.json`).
- **pnpm 10** through Corepack (`packageManager` field): `corepack enable`.
- Docker, for images and local services (see [`local-development.md`](local-development.md)).

## Layout (summary)

```
apps/
  web/      @globetrot/web      Next.js 16 App Router (account screens, settings, the app). Standalone output for Docker
  api/      @globetrot/api      Hono + OpenAPI HTTP adapter and Better Auth. Bundled with tsup into dist/
  worker/   @globetrot/worker   Background jobs. A placeholder today (pg-boss later). Bundled with tsup into dist/
packages/
  config/       @globetrot/config       Shared tsconfig presets (base, library, nextjs)
  domain/       @globetrot/domain       Pure domain rules. Relative imports only (lint-enforced)
  application/  @globetrot/application  Commands/queries + ports. No UI/HTTP/DB framework imports (lint-enforced)
  db/           @globetrot/db           Drizzle schema, SQL migrations, connection and test-database helpers (data-model.md)
  api-client/   @globetrot/api-client   Typed client generated from the committed OpenAPI file (`pnpm api:generate`)
  tokens/       @globetrot/tokens       Design tokens (DTCG source to CSS variables and TypeScript)
  ui/           @globetrot/ui           Web components (React Aria + Tailwind) + Storybook
  i18n/         @globetrot/i18n         ICU message catalogs (en, pt-BR) and locale helpers
eslint.config.mjs   One flat ESLint config for the repo, including the architecture boundary rules
turbo.json          Task graph: build, dev, lint, typecheck, test, test:int. apps/web/turbo.json makes the web build wait for the tokens build and for the web typecheck (they share `.next`), and dev wait for the tokens build; neither waits for the Storybook build of @globetrot/ui
compose.yaml        Local services (Postgres + PostGIS, S3 storage, Mailpit). See local-development.md
infra/              Local service init scripts, the services check and the docs check
```

## What is in each app and package

Where to look, so you can find things without searching. Behaviour is documented in the owning docs linked from [`../agents/context-map.md`](../agents/context-map.md).

### `apps/api`

| File | Role |
|---|---|
| `src/index.ts` | Entry point: loads config, connects the database, serves, shuts down cleanly |
| `src/config.ts` | The only reader of the environment ([`configuration.md`](configuration.md)) |
| `src/auth.ts` | Better Auth: email and password, sessions, verification and reset emails, the sign-up language hook, the email cooldown |
| `src/app.ts` | The Hono app: Origin check, public routes, the session middleware that creates the actor, error handling, the OpenAPI document |
| `src/routes/*.ts` | One file per area (`trips`, `preferences`, `providers`). Handlers only call one operation |
| `src/wire.ts` | Composition root: database, repositories, clock, ids, SMTP sender, Better Auth |
| `src/problem.ts`, `src/http.ts` | problem+json helpers and shared types |
| `src/email.ts` | The SMTP `EmailPort` (nodemailer) |
| `src/openapi.ts`, `src/generate-openapi.ts` | Builds the OpenAPI document without a database; `pnpm api:generate` writes it |
| `src/testing/mailpit.ts` | Test helper that reads the mail the API sent, over Mailpit's HTTP API |
| `*.test.ts`, `*.int.test.ts` | Unit tests; integration tests (real Postgres and Mailpit) |

### `apps/web`

| Path | Role |
|---|---|
| `proxy.ts` | Forwards `/api/auth/*` and `/v1/*` to the API, and sends anonymous visitors of `/app` to `/login?next=…` ([ADR-0010](../architecture/adr/0010-web-proxies-the-api.md)) |
| `app/(auth)/` | Account screens: `login`, `signup`, `recover`, `reset-password`, `email-verified`, with `_components/` (forms, password field, resend control, language switcher) and `auth.module.css` |
| `app/(legal)/` | Draft `/terms` and `/privacy` |
| `app/app/` | The signed-in area (a placeholder until #59): layout with the session check, page, sign-out button |
| `app/settings/` | Provisional language and region page |
| `app/actions.ts` | Server actions: language cookie, save settings |
| `i18n/` | next-intl request config (stored language wins, cookie fallback), locale helpers |
| `lib/` | `auth-client` (browser calls to `/api/auth/*`), `auth-errors` (stable codes to messages), `safe-next`, `password-strength`, `countdown`, `stored-preferences`, `current-user`, `providers`, `api-proxy`, `app-gate` |
| `scripts/check-auth-pages.mjs` | The real-browser check of the account screens (`pnpm --filter @globetrot/web test:a11y`) |

### Packages

| Package | Key files |
|---|---|
| `domain` | `money/`, `time/`, `trip/` (days, totals, savings, milestones, journey, status), `geo/` (countries, time zones), `id/` (UUIDv7), `auth.ts` (password limits), `preferences.ts` |
| `application` | `operation.ts` (`defineOperation`), `ports.ts`, `errors.ts`, `authorization.ts`, `trips/`, `preferences/`, `queries/`, `email/` (templates and the port), `testing/` (in-memory ports for tests) |
| `db` | `src/schema/` (auth, trip, preference), `migrations/`, `src/repositories.ts` (PostgreSQL adapters), `src/migrate.ts`, `src/admin.ts`, `src/testing/` (throwaway databases) |
| `api-client` | `openapi.json` and `src/generated/schema.ts` (generated), `src/index.ts` (`createApiClient`) |
| `i18n` | `messages/en.json`, `messages/pt-BR.json`, `src/` (locales, formatting, validation), `scripts/check-messages.ts` |
| `tokens` | `source/*.tokens.json`, `scripts/build.mjs` (CSS and TS), `scripts/contrast.mjs` |
| `ui` | `src/*.tsx` components and stories, `.storybook/`, `scripts/check-a11y.mjs` |


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
| `pnpm test:int` | Integration tests against real PostgreSQL and Mailpit (run `pnpm services:up` first). Not part of `pnpm test` |
| `pnpm docs:check` | Documentation links, anchors, the docs index and `.env.example` coverage |
| `pnpm --filter @globetrot/web test:a11y` | Real-browser check of the account screens with axe (needs `pnpm turbo run build --filter=@globetrot/web` and Chromium) |
| `pnpm services:up` / `services:check` / `services:down` / `services:reset` | Local services ([`local-development.md`](local-development.md)) |
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
