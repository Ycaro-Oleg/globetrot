# Current state

_Last updated: 2026-11-07, after the repository foundation (M0)._

## Phase

**Phase 0: Product Foundation (M0).** The planning deliverables are approved. There is no application code yet.

## Done

- Product vision, MVP PRD, business rules, roadmap.
- Design audit of Claude Design v1, plus the design-system direction.
- Architecture overview, domain model, money, i18n.
- ADRs 0001–0009.
- Agent entry points (`AGENTS.md`, `CLAUDE.md`), context map, handoff convention.
- Issue and PR templates.
- Claude Design v1 handoff copied to `design/reference/claude-design-v1/`.

## Next

1. **M1: Design System & Spikes.** Tokens v1.1, Storybook primitives, MapLibre spike, Places spike, usability test plan.
2. **M2: Engineering Foundation.** Monorepo, CI, local Docker Compose, Money/FX and savings rules in `packages/domain`.

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
