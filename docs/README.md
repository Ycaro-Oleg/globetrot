# Globetrot documentation

This folder is the canonical source of project knowledge. Each doc owns one topic: link to it, don't copy it. When code changes a rule, a contract or a convention, update the owning doc in the same PR.

Agents: don't read everything. Use [`agents/context-map.md`](agents/context-map.md) to choose what you need.

## Index

### Agents
- [`agents/current-state.md`](agents/current-state.md): active milestone, open work, blockers. **Read first.**
- [`agents/context-map.md`](agents/context-map.md): which docs to read for each task type.
- [`agents/handoff.md`](agents/handoff.md): handoff convention between agents and sessions.

### Product
- [`product/vision.md`](product/vision.md): vision, audience, differentiators, lifecycle.
- [`product/prd.md`](product/prd.md): MVP scope, feature classification, acceptance criteria.
- [`product/business-rules.md`](product/business-rules.md): authoritative business rules (currency, budget, savings, stamps, AI, privacy).
- [`product/roadmap.md`](product/roadmap.md): milestones, dependencies, exit criteria.

### Design
- [`design/design-audit.md`](design/design-audit.md): review of the Claude Design v1 prototype (Preserve / Refine / Replace / Add).
- [`design/design-system.md`](design/design-system.md): tokens, components, motion, accessibility, responsive models.
- Reference prototype: [`../design/reference/claude-design-v1/`](../design/reference/claude-design-v1/).

### Architecture
- [`architecture/overview.md`](architecture/overview.md): stack, layers, deployment shape.
- [`architecture/domain-model.md`](architecture/domain-model.md): bounded contexts, entities, relationships.
- [`architecture/money.md`](architecture/money.md): money, currencies, exchange rates.
- [`architecture/data-model.md`](architecture/data-model.md): database conventions (ids, timestamps, money, enums), migrations, extensions, integration testing.
- [`architecture/i18n.md`](architecture/i18n.md): languages, locales, formatting, message catalogs.
- [`architecture/api-contracts.md`](architecture/api-contracts.md): the `/v1` API: actor, problem+json errors, how to add an operation, generated typed client.
- [`architecture/authentication.md`](architecture/authentication.md): sign-up and sessions as built: web proxy and first-party cookie, configuration, rate limits, Origin check, client-address trust model, error codes.
- [`architecture/adr/`](architecture/adr/): Architecture Decision Records.
- [`architecture/spikes/`](architecture/spikes/): spike findings. [`maplibre.md`](architecture/spikes/maplibre.md) covers the map stack (#2), and [`places.md`](architecture/spikes/places.md) covers places search on GeoNames + PostGIS (#3).

### Engineering
- [`engineering/git-workflow.md`](engineering/git-workflow.md): branches, issues, PRs, commits, releases.
- [`engineering/project-structure.md`](engineering/project-structure.md): monorepo layout, package conventions, commands, Docker images.
- [`engineering/local-development.md`](engineering/local-development.md): local services (Postgres + PostGIS, S3 storage, Mailpit), `.env`, troubleshooting.
- [`engineering/coding-standards.md`](engineering/coding-standards.md): TypeScript, naming, architecture boundaries, money/dates/copy, errors, config, React, dependencies.
- [`engineering/testing-strategy.md`](engineering/testing-strategy.md): test layers, what each change must test, writing deterministic tests, coverage, flaky tests.

### Integrations
- [`integrations/stripe.md`](integrations/stripe.md): commercial architecture (planned, M10).
- [`integrations/mcp.md`](integrations/mcp.md): external MCP server (planned, M12+).

## Docs that will be added when they have content

`architecture/api-contracts.md` (M3). `integrations/ai-companion.md` (M7). `infrastructure/*` (M11). `product/user-flows.md`, `product/monetization.md` (when those decisions are made). Don't create empty placeholders.
