# Current state

_Last updated: 2026-11-07, after initial design token foundations (#5)._

## Phase

**M2 complete. M1 (design system & spikes) is open.** The engineering foundation, the core domain rules (money, trip derivations) and i18n are in `develop`. There are no screens or persistence yet. M3 (App Foundation) needs M1's tokens and spikes, plus an issue breakdown.

## Done (M2)

- pnpm + Turborepo monorepo: `apps/{web,api,worker}`, `packages/{config,domain,application,db,api-client,tokens,ui,i18n}`, with smoke tests. See `docs/engineering/project-structure.md`.
- Shared tsconfig presets and one flat ESLint config, with boundary rules (`domain` pure, `application` framework-free).
- Dockerfiles for web, api and worker (turbo prune, Node 24 alpine, non-root). Built and smoke-tested locally.
- GitHub Actions CI (#11): format, lint, typecheck, test and build on every PR and on pushes to `develop`/`main`. The E2E and axe jobs are skipped placeholders for now.
- Money value object (#13) in `@globetrot/domain`: ISO 4217 registry, exact arithmetic, allocation, FX conversion with provenance, locale formatting. 100% covered. See `docs/architecture/money.md`.
- Trip derivations (#14) in `@globetrot/domain`: days, totals, savings plan, 9 readiness milestones plus stamp recording, journey stage, next steps, and `LocalDate` helpers. They match the prototype's Japan demo and are 100% covered. See `docs/product/business-rules.md`.
- i18n package (#15): en/pt-BR ICU catalogs (seeded with status marks, journey, milestones, next steps, savings sentences), typed keys, `formatMessage`, date/month formatting and locale negotiation. The catalog check runs in `pnpm lint`, so CI fails on missing keys or placeholder mismatches. See `docs/architecture/i18n.md`.
- Local services (#12): `compose.yaml` runs Postgres 17 + PostGIS (with pg_trgm and unaccent), S3-compatible storage (SeaweedFS, because MinIO images are no longer published) with the bucket auto-created, and Mailpit. Also `.env.example`, the `pnpm services:*` scripts and `pnpm services:check`. See `docs/engineering/local-development.md`.
- Engineering standards (#16): `docs/engineering/coding-standards.md` and `testing-strategy.md`, linked from AGENTS.md's definition of done.

## Done (M0)

- Product vision, MVP PRD, business rules, roadmap.
- Design audit of Claude Design v1, plus the design-system direction.
- Architecture overview, domain model, money, i18n.
- ADRs 0001–0009.
- Agent entry points (`AGENTS.md`, `CLAUDE.md`), context map, handoff convention.
- Issue and PR templates.
- Claude Design v1 handoff copied to `design/reference/claude-design-v1/`.

## Next

1. **M1: Design System & Spikes** (#2–#9):
   - MapLibre spike (#2) **done**: go, with conditions. See `docs/architecture/spikes/maplibre.md` (real-device FPS still pending). Places spike (#3) **done**: go. See `docs/architecture/spikes/places.md`. Geocoding evaluation (#4) remains open: initial terms and pricing research is documented; provider quality tests and a final decision remain;
   - tokens v1.1 (#5) in progress: initial source, theme CSS and TypeScript, contrast checks and demo landed; complete the remaining handoff token coverage and DTCG interoperability before closing; then Storybook primitives (#6);
   - missing-screen specs (#7), usability test (#8), Pip brief (#9).
2. **M3: App Foundation.** Break it into issues once M1's tokens and spikes settle: auth (Better Auth), next-intl in `apps/web`, preferences, responsive shell and themes, `packages/db` schema and trip CRUD.

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
