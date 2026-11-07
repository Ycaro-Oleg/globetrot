# Globetrot

Globetrot is an international travel-planning app with a social layer. It turns "someday" into a plan people can actually reach. Users plan a trip on an interactive world-map board, get a realistic budget and a savings plan that answers *"when can I afford this?"*, and can ask an optional AI companion (Pip). Real milestones are rewarded with stamps in a digital passport.

> **Status:** Phase 0, planning and repository foundation. There is no application code yet. See [`docs/agents/current-state.md`](docs/agents/current-state.md).

## Start here

| You are… | Read |
|---|---|
| A coding agent (Codex, Claude Code, …) | [`AGENTS.md`](AGENTS.md) |
| A human contributor | [`docs/README.md`](docs/README.md), then [`docs/engineering/git-workflow.md`](docs/engineering/git-workflow.md) |
| Looking for the product vision | [`docs/product/vision.md`](docs/product/vision.md) |
| Looking for the design | [`docs/design/design-audit.md`](docs/design/design-audit.md) and [`design/reference/claude-design-v1/`](design/reference/claude-design-v1/) |

## Non-negotiables (short version)

- Global-first: English and Brazilian Portuguese ship from day one, and more languages must be easy to add.
- USD is the default budgeting currency. Users can change it, and language, location and currency are independent settings.
- The interactive map is the core feature. Every map action also has a path outside the map.
- AI is optional and always user-controlled: it proposes, previews, and changes nothing without user approval.
- Business rules live in shared domain/application packages, never in UI components.
- Work flows through milestones → issues → `feature/*` branches → PRs into `develop`.

## Repository layout

```
AGENTS.md              Canonical entry point for coding agents
CLAUDE.md              Claude Code entry point (imports AGENTS.md)
docs/                  Canonical project knowledge (product, design, architecture, engineering, agents)
design/reference/      Frozen design references (Claude Design handoff v1)
apps/                  web (Next.js), api (Hono), worker
packages/              domain, application, db, api-client, tokens, ui, i18n, config
.github/               Issue and PR templates, CI workflow
```

## Quick start

Requires Node 24 (`.nvmrc`) and pnpm via Corepack.

```bash
corepack enable && pnpm install
pnpm dev        # web on :3000, api on :4000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Details: [`docs/engineering/project-structure.md`](docs/engineering/project-structure.md).
