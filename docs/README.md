# Globetrot documentation

This folder is the canonical source of project knowledge. Each doc owns one topic: link to it, don't copy it. When code changes a rule, a contract or a convention, update the owning doc in the same PR (the table in [`agents/playbook.md`](agents/playbook.md#which-docs-to-update) says which). `pnpm docs:check` verifies links, anchors, this index and the settings reference.

Agents: don't read everything. Use [`agents/context-map.md`](agents/context-map.md) to choose what you need.

## Index

### Agents
- [`agents/current-state.md`](agents/current-state.md): where the project is, what exists, open work, owner-dependent items, known gaps, next steps. **Read first.**
- [`agents/playbook.md`](agents/playbook.md): how to take an issue to a merged PR, how to verify, the owner's rules and pitfalls that already cost time.
- [`agents/context-map.md`](agents/context-map.md): which docs to read for each task type.
- [`agents/handoff.md`](agents/handoff.md): handoff convention and the end-of-session checklist.
- [`glossary.md`](glossary.md): the words this project uses, and what each means.

### Product
- [`product/vision.md`](product/vision.md): vision, audience, differentiators, lifecycle.
- [`product/prd.md`](product/prd.md): MVP scope, feature classification, acceptance criteria.
- [`product/business-rules.md`](product/business-rules.md): authoritative business rules (accounts, currency, trips, budget, savings, stamps, AI, privacy).
- [`product/roadmap.md`](product/roadmap.md): milestones, status, dependencies, exit criteria.
- [`product/progress.md`](product/progress.md): each PRD feature, what is built, what is left, issues and docs.
- [`product/research/usability-01.md`](product/research/usability-01.md): the protocol for the prototype usability test (#8). No sessions have been run.

### Design
- [`design/design-audit.md`](design/design-audit.md): review of the Claude Design v1 prototype (Preserve / Refine / Replace / Add) and what has been resolved.
- [`design/design-system.md`](design/design-system.md): tokens, components, motion, accessibility, responsive models, patterns first used by the account screens.
- [`design/missing-screens.md`](design/missing-screens.md): specs for the screens the prototype lacks (#7, awaiting the owner's review).
- [`design/pip-character.md`](design/pip-character.md): the brief for Pip's illustration and states (#9, awaiting approval).
- Reference prototype: [`../design/reference/claude-design-v1/`](../design/reference/claude-design-v1/).

### Architecture
- [`architecture/overview.md`](architecture/overview.md): stack, layers, what exists today, deployment shape.
- [`architecture/domain-model.md`](architecture/domain-model.md): bounded contexts, entities, relationships, application-layer conventions.
- [`architecture/money.md`](architecture/money.md): money, currencies, exchange rates.
- [`architecture/data-model.md`](architecture/data-model.md): database conventions, the schema reference (every table), migrations, extensions, integration testing.
- [`architecture/i18n.md`](architecture/i18n.md): languages, locales, formatting, message catalogs, the web integration, emails.
- [`architecture/api-contracts.md`](architecture/api-contracts.md): the `/v1` API: actor, problem+json errors, every operation, idempotency, audit, how to add an operation, the typed client.
- [`architecture/authentication.md`](architecture/authentication.md): sessions, the web proxy and first-party cookie, email verification and recovery, the account screens, redirect rules, rate limits, error codes.
- [`architecture/adr/`](architecture/adr/README.md): Architecture Decision Records (0001 to 0019).
- [`architecture/spikes/maplibre.md`](architecture/spikes/maplibre.md): the map stack spike (#2). [`places.md`](architecture/spikes/places.md): places search on GeoNames + PostGIS (#3). [`geocoding.md`](architecture/spikes/geocoding.md): managed geocoding evaluation (#4, open).

### Engineering
- [`engineering/git-workflow.md`](engineering/git-workflow.md): branches, issues, PRs, commits, required checks, merge rules, releases.
- [`engineering/project-structure.md`](engineering/project-structure.md): monorepo layout, what is in each app and package, commands, Docker images.
- [`engineering/configuration.md`](engineering/configuration.md): every environment variable, who reads it, what production requires.
- [`engineering/local-development.md`](engineering/local-development.md): local services, `.env`, running the apps, troubleshooting.
- [`engineering/launch-runbook.md`](engineering/launch-runbook.md): putting Globetrot in production (Coolify services, required settings, first deploy, smoke test) and the owner's launch decisions.
- [`engineering/coding-standards.md`](engineering/coding-standards.md): TypeScript, naming, architecture boundaries, money/dates/copy, errors, config, React, dependencies.
- [`engineering/testing-strategy.md`](engineering/testing-strategy.md): test layers, what each change must test, deterministic tests, coverage, flaky tests.
- [`engineering/m3-foundation-breakdown.md`](engineering/m3-foundation-breakdown.md): the M3 plan, the dependency table and the PR that delivered each slice. A model for breaking down a milestone.

### Integrations
- [`integrations/stripe.md`](integrations/stripe.md): commercial architecture (planned, M10).
- [`integrations/mcp.md`](integrations/mcp.md): external MCP server (planned, M12+).

## Docs that will be added when they have content

`integrations/ai-companion.md` (M7). `infrastructure/*` (M11). `product/user-flows.md`, `product/monetization.md` (when those decisions are made). Data export and deletion design (before a public release). Don't create empty placeholders.
