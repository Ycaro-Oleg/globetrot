# Globetrot

Globetrot is an international travel-planning app with a social layer. It turns "someday" into a plan people can actually reach. Users plan a trip on an interactive world-map board, get a realistic budget and a savings plan that answers *"when can I afford this?"*, and can ask an optional AI companion (Pip). Real milestones are rewarded with stamps in a digital passport.

> **Status:** early build, milestone M3 (App Foundation). Accounts, sign-in, email verification and recovery, preferences and private trips (through the API) work end to end; the map board, itinerary, budget, Pip, landing and billing are not built yet. Nothing is deployed. The living status is in [`docs/agents/current-state.md`](docs/agents/current-state.md) and per feature in [`docs/product/progress.md`](docs/product/progress.md).

## Start here

| You are… | Read |
|---|---|
| A coding agent (Codex, Claude Code, …) | [`AGENTS.md`](AGENTS.md), then [`docs/agents/current-state.md`](docs/agents/current-state.md) and [`docs/agents/playbook.md`](docs/agents/playbook.md) |
| A human contributor | [`docs/README.md`](docs/README.md) (the index), then [`docs/engineering/git-workflow.md`](docs/engineering/git-workflow.md) |
| Looking for the product vision and scope | [`docs/product/vision.md`](docs/product/vision.md), [`docs/product/prd.md`](docs/product/prd.md), [`docs/product/roadmap.md`](docs/product/roadmap.md) |
| Looking for the rules of the product | [`docs/product/business-rules.md`](docs/product/business-rules.md) and the [`docs/glossary.md`](docs/glossary.md) |
| Looking for the design | [`docs/design/design-audit.md`](docs/design/design-audit.md) and [`design/reference/claude-design-v1/`](design/reference/claude-design-v1/) |
| Wondering why something is the way it is | [`docs/architecture/adr/`](docs/architecture/adr/README.md) |

## Non-negotiables (short version)

- Global-first: English and Brazilian Portuguese ship from day one, and more languages must be easy to add.
- USD is the default budgeting currency. Users can change it, and language, location and currency are independent settings.
- The interactive map is the core feature. Every map action also has a path outside the map.
- AI is optional and always user-controlled: it proposes, previews, and changes nothing without user approval.
- Business rules live in shared domain/application packages, never in UI components.
- Work flows through milestones → issues → `feature/*` branches → PRs into `develop`, and the owner approves every merge.

## Repository layout

```
AGENTS.md              Canonical entry point for coding agents
CLAUDE.md              Claude Code entry point (imports AGENTS.md)
docs/                  Canonical project knowledge (product, design, architecture, engineering, agents)
design/reference/      Frozen design references (Claude Design handoff v1)
apps/                  web (Next.js), api (Hono), worker (placeholder)
packages/              domain, application, db, api-client, tokens, ui, i18n, config
infra/                 Local service init scripts and the services check
compose.yaml           Local services: Postgres + PostGIS, S3 storage, Mailpit
.env.example           Local defaults for every setting (see docs/engineering/configuration.md)
.github/               Issue and PR templates, CI workflow
```

## Quick start

Requires Node 24 (`.nvmrc`), pnpm via Corepack and Docker.

```bash
cp .env.example .env && corepack enable && pnpm install
pnpm services:up && pnpm services:check        # Postgres + PostGIS, S3 storage, Mailpit
pnpm --filter @globetrot/db migrate            # create the schema
pnpm dev                                       # web on :3000, api on :4000
```

Open <http://localhost:3000/signup>, create an account, read the confirmation email in Mailpit (<http://localhost:8025>), open its link and log in.

Before opening a PR, run what CI runs:

```bash
pnpm format:check && pnpm turbo run lint typecheck test build
pnpm test:int       # integration tests, needs `pnpm services:up`
pnpm docs:check     # documentation links, index and settings coverage
```

More: [`docs/engineering/local-development.md`](docs/engineering/local-development.md), [`docs/engineering/project-structure.md`](docs/engineering/project-structure.md), [`docs/engineering/configuration.md`](docs/engineering/configuration.md).
