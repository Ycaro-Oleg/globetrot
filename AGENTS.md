# AGENTS.md

This is the entry point for every coding agent working on Globetrot (Codex, Claude Code, others) and for humans who want the short version. It is deliberately brief. Details live in `docs/`, which is the **single source of truth**. If this file and a doc disagree, the doc wins: fix this file.

## 1. What Globetrot is

A global travel-planning app with a social layer. The flagship feature is the **interactive world-map board**: pins, airmail routes and destination cards. Around it sit a multi-currency budget and savings plan, an **optional** AI companion (Pip) that only proposes reviewable change lists, a digital passport with stamps, and, later, social features, a 100-rank progression system and an MCP server.

Lifecycle: Dream → Discover → Plan → Save → Unlock → Explore → Remember → Share.
Vision: [`docs/product/vision.md`](docs/product/vision.md) · MVP scope: [`docs/product/prd.md`](docs/product/prd.md)

## 2. Product constraints you must respect

1. **Global-first i18n.** `en` and `pt-BR` are required from day one. Never hardcode user-facing text in components; use message catalogs. See [`docs/architecture/i18n.md`](docs/architecture/i18n.md).
2. **USD is the default currency.** Never infer currency from language, country or nationality. Money is integer minor units plus an ISO 4217 code, and every conversion records its rate and source. See [`docs/architecture/money.md`](docs/architecture/money.md).
3. **AI is optional.** Every feature must be fully usable manually. AI output is a structured proposal that the user previews and applies, and it can be undone. The AI never invents bookings, prices, availability or entry rules.
4. **Map actions always have a non-map path**: list, search or form. Every drag-and-drop has a keyboard alternative.
5. **Accessibility target: WCAG 2.2 AA** in light and dark themes. Never encode status by colour alone.
6. **Honesty.** Estimates are labelled as estimates. The passport is decorative, never an official document. A visit is never shown as "verified" without a real mechanism.
7. **Pricing is mocked** until approved. No real Stripe charges, and no production deployment before the Production Readiness milestone.

Full rules: [`docs/product/business-rules.md`](docs/product/business-rules.md)

## 3. Repository map

| Path | What |
|---|---|
| `docs/` | Canonical knowledge. Index: [`docs/README.md`](docs/README.md) |
| `docs/agents/` | Current state, context map, handoff convention |
| `docs/architecture/adr/` | Architecture Decision Records. Read the ones relevant to your task |
| `design/reference/claude-design-v1/` | High-fidelity HTML prototype + design handoff (tokens, components, behaviour). A **reference**, not production code |
| `apps/*`, `packages/*` | pnpm + Turborepo monorepo (Node 24, pnpm 10). Layout, conventions and commands: [`docs/engineering/project-structure.md`](docs/engineering/project-structure.md) |

## 4. How to start a session (context rehydration)

1. Read this file.
2. Read [`docs/agents/current-state.md`](docs/agents/current-state.md) to find the active milestone, open work and blockers.
3. Use [`docs/agents/context-map.md`](docs/agents/context-map.md) to choose **only** the docs relevant to your task type.
4. Read the GitHub issue you are working on (acceptance criteria are the contract).
5. If there is a handoff on the issue or PR, read it. See [`docs/agents/handoff.md`](docs/agents/handoff.md).
6. Open only the source files you need. Don't read all of `docs/`.

## 5. Workflow

Full details: [`docs/engineering/git-workflow.md`](docs/engineering/git-workflow.md)

- Branches: `main` (release-ready), `develop` (integration), `feature/issue-<n>-<slug>`, `fix/issue-<n>-<slug>`, `docs/<slug>`, `chore/<slug>`, `spike/issue-<n>-<slug>`, `hotfix/<slug>`.
- Branch from `develop` and open a PR into `develop`. Only release PRs go `develop → main`.
- **Never push directly to `main` or `develop`.** Protection is by convention plus CI (the private repo is on GitHub Free), so it depends on you.
- One issue → one focused branch → one reviewable PR. Don't mix unrelated changes.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(budget): …`, `fix(map): …`, `docs: …`, `chore: …`.

## 6. Definition of done

- The issue's acceptance criteria are met.
- Code follows [`docs/engineering/coding-standards.md`](docs/engineering/coding-standards.md).
- Tests are added or updated per the issue and [`docs/engineering/testing-strategy.md`](docs/engineering/testing-strategy.md). Lint, typecheck and tests pass locally and in CI.
- User-facing strings exist in **both** `en` and `pt-BR`.
- **Canonical docs are updated** whenever a business rule, contract, architecture decision or convention changes. If the decision is significant, write a new ADR.
- The PR description includes the handoff section.
- `docs/agents/current-state.md` is updated when the PR changes the project state.

## 7. Architecture boundaries

- Business rules live in `packages/domain` (pure, framework-free) and `packages/application` (commands and queries with authorization, idempotency and audit).
- Web, mobile, the Pip companion, the future MCP server, background jobs and admin tools all call the **same** application commands and queries.
- UI components never contain business rules. Adapters (Stripe, AI, geocoding, FX, storage, email) sit behind ports.
- Stack and rationale: [ADR-0002](docs/architecture/adr/0002-monorepo-and-stack.md).

## 8. Ask the human before

- Changing a business rule, pricing, the stack, or anything already decided in an ADR.
- Adding a heavy dependency, or a library that overlaps one already chosen.
- Creating many issues, changing milestones, or any GitHub settings.
- Anything that deploys, charges money, sends email to real people or publishes content.

## 9. Never

- Commit secrets, credentials, private keys, `.env` files or real user data, including in docs and handoffs.
- Use the public Nominatim API or public OSM tile servers in the product.
- Hardcode prices, currencies or user-facing copy in components.
- Mark mock pricing as a real offer, or activate Stripe live mode.
- Rewrite history on shared branches (`main`, `develop`).

## 10. Language policy

Docs, code, identifiers, commits, issues and PRs are in **English**. User-facing copy lives in message catalogs (`en`, `pt-BR`, …). The product owner communicates in Brazilian Portuguese, so agents should reply to them in pt-BR. See [ADR-0001](docs/architecture/adr/0001-documentation-and-language-policy.md).
