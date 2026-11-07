# Architecture overview

Status: **approved direction**. Decisions are recorded in [`adr/`](adr/). The monorepo itself is created in M2.

## Shape

```mermaid
flowchart LR
  subgraph Clients
    W[apps/web<br/>Next.js: landing + app]
    M[apps/mobile<br/>Expo, post-MVP]
    P[Pip companion]
    X[apps/mcp<br/>MCP server, M12+]
  end
  W & M & P & X --> API[apps/api<br/>Hono + OpenAPI]
  API --> APP[packages/application<br/>commands & queries<br/>authz · idempotency · audit]
  APP --> DOM[packages/domain<br/>pure rules: Money, dates,<br/>totals, savings, milestones, XP]
  APP --> DB[(PostgreSQL + PostGIS)]
  APP --> JOBS[apps/worker<br/>pg-boss: FX, email, AI, media]
  APP --> PORTS[Ports: Geocoding · FX · AI ·<br/>Storage · Stripe · Email]
```

**The core rule:** web, mobile, Pip, the MCP server, background jobs and admin tools all call the **same** application commands and queries. UI components hold no business rules.

## Planned monorepo (pnpm + Turborepo)

```
apps/
  web/        Next.js App Router: marketing (SSG/SSR) + app under /app
  api/        Hono + @hono/zod-openapi (REST, OpenAPI contract)
  worker/     pg-boss consumers
  mobile/     Expo (post-MVP)
  mcp/        Remote MCP server (M12+)
packages/
  domain/       Pure TypeScript domain: entities, value objects (Money), rules. No I/O
  application/  Use cases (commands/queries), Zod schemas, authorization, ports
  db/           Drizzle schema + migrations (PostgreSQL + PostGIS)
  api-client/   Typed client generated from OpenAPI
  tokens/       Design tokens (DTCG JSON → CSS vars / TS)
  ui/           Web component library (React Aria + Tailwind) + Storybook
  i18n/         ICU message catalogs + formatting helpers
  config/       Shared tsconfig, eslint, prettier
```

## Stack summary

| Concern | Choice | ADR |
|---|---|---|
| Language | TypeScript everywhere | 0002 |
| Web | Next.js (App Router), TanStack Query, Zustand | 0002 |
| API | Hono + Zod/OpenAPI (REST) | 0006 |
| DB | PostgreSQL 17 + PostGIS, Drizzle ORM | 0002 |
| Jobs | pg-boss (Postgres-backed queue, no Redis in the MVP) | 0002 |
| Auth | Better Auth (email/password, Google, sessions; OAuth 2.1 provider later for MCP) | 0005 |
| Map | MapLibre GL JS + Protomaps PMTiles (OSM), GeoNames places in PostGIS, managed geocoder behind a port | 0003 |
| Money | Integer minor units + ISO 4217, FX rate records | 0004 |
| i18n | ICU messages, `next-intl` (web), `use-intl` (RN) | 0008 |
| UI | React Aria Components + Tailwind v4 + tokens, Storybook | — ([design-system](../design/design-system.md)) |
| Motion | motion/react, CSS, Rive (Pip) | — |
| AI | Vercel AI SDK (provider-agnostic), structured output via Zod | 0007 |
| Media | S3-compatible (Hetzner Object Storage; MinIO locally) | — |
| Email | Resend or Postmark (decided in M3) | — |
| Errors | Sentry-compatible (Sentry or self-hosted GlitchTip) | — |
| Tests | Vitest, Playwright, axe-core | — (testing-strategy, M2) |

## Deployment shape (executed in M11)

Containers `web`, `api` and `worker` run on Hetzner via Coolify, alongside PostgreSQL + PostGIS on a persistent volume. PMTiles and media live in object storage behind a CDN. All configuration comes from environment variables, and secrets live in Coolify. Scheduled `pg_dump` backups go to off-server storage, with a tested restore. Dockerfiles exist from M2, so local and production stay close.
