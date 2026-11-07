# Current state

_Last updated: 2026-11-07, after trip derivations (#14)._

## Phase

**M1 + M2 in progress.** M0 docs are merged. The monorepo scaffold exists (#10), with no product features yet.

## Done (M2)

- pnpm + Turborepo monorepo: `apps/{web,api,worker}`, `packages/{config,domain,application,db,api-client,tokens,ui,i18n}`, with smoke tests. See `docs/engineering/project-structure.md`.
- Shared tsconfig presets and one flat ESLint config, with boundary rules (`domain` pure, `application` framework-free).
- Dockerfiles for web, api and worker (turbo prune, Node 24 alpine, non-root). Built and smoke-tested locally.
- GitHub Actions CI (#11): format, lint, typecheck, test and build on every PR and on pushes to `develop`/`main`. The E2E and axe jobs are skipped placeholders for now.
- Money value object (#13) in `@globetrot/domain`: ISO 4217 registry, exact arithmetic, allocation, FX conversion with provenance, locale formatting. 100% covered. See `docs/architecture/money.md`.
- Trip derivations (#14) in `@globetrot/domain`: days, totals, savings plan, 9 readiness milestones plus stamp recording, journey stage, next steps, and `LocalDate` helpers. They match the prototype's Japan demo and are 100% covered. See `docs/product/business-rules.md`.

## Done (M0)

- Product vision, MVP PRD, business rules, roadmap.
- Design audit of Claude Design v1, plus the design-system direction.
- Architecture overview, domain model, money, i18n.
- ADRs 0001–0009.
- Agent entry points (`AGENTS.md`, `CLAUDE.md`), context map, handoff convention.
- Issue and PR templates.
- Claude Design v1 handoff copied to `design/reference/claude-design-v1/`.

## Next

1. **M1: Design System & Spikes.** Tokens v1.1, Storybook primitives, MapLibre spike, Places spike, usability test plan.
2. **M2: Engineering Foundation.** Local Docker Compose (#12), i18n skeleton (#15), engineering standards (#16).

See the GitHub milestones for open issues.

## Decisions taken (summary)

- Stack A (ADR-0002).
- The MVP is responsive web/PWA, with Expo after the MVP.
- Pip v1 joins the MVP behind a flag (M7).
- Protection is by convention plus CI (ADR-0009).
- The Stripe account is in Brazil (`integrations/stripe.md`).
- The passport belongs to the account, with a visa page per trip.

## Open decisions

- Pricing and plan limits (before M10).
- Email provider (Resend vs Postmark, in M3).
- Managed geocoding provider (in the M1 spike).
- Pip Rive illustrator / asset timeline.
- Imagery licensing source.

## Blockers

None.
