# Current state

_Last updated: 2026-11-07, after the database foundation (#52)._

## Phase

**M2 complete. M1 (design system & spikes) is open.** The engineering foundation, the core domain rules (money, trip derivations) and i18n are in `develop`. There are no screens or persistence yet. M3 (App Foundation) needs M1's tokens and spikes, plus an issue breakdown.

## Done (M2)

- pnpm + Turborepo monorepo: `apps/{web,api,worker}`, `packages/{config,domain,application,db,api-client,tokens,ui,i18n}`, with smoke tests. See `docs/engineering/project-structure.md`.
- Shared tsconfig presets and one flat ESLint config, with boundary rules (`domain` pure, `application` framework-free).
- Dockerfiles for web, api and worker (turbo prune, Node 24 alpine, non-root). Built and smoke-tested locally.
- GitHub Actions CI (#11): format, lint, typecheck, test and build on every PR and on pushes to `develop`/`main`. A separate job runs axe over the Storybook stories (`@globetrot/ui` `test:a11y`). The E2E job is still a skipped placeholder.
- Money value object (#13) in `@globetrot/domain`: ISO 4217 registry, exact arithmetic, allocation, FX conversion with provenance, locale formatting. 100% covered. See `docs/architecture/money.md`.
- Trip derivations (#14) in `@globetrot/domain`: days, totals, savings plan, 9 readiness milestones plus stamp recording, journey stage, next steps, and `LocalDate` helpers. They match the prototype's Japan demo and are 100% covered. See `docs/product/business-rules.md`.
- i18n package (#15): en/pt-BR ICU catalogs (seeded with status marks, journey, milestones, next steps, savings sentences), typed keys, `formatMessage`, date/month formatting and locale negotiation. The catalog check runs in `pnpm lint`, so CI fails on missing keys or placeholder mismatches. See `docs/architecture/i18n.md`.
- Local services (#12): `compose.yaml` runs Postgres 17 + PostGIS (with pg_trgm and unaccent), S3-compatible storage (SeaweedFS, because MinIO images are no longer published) with the bucket auto-created, and Mailpit. Also `.env.example`, the `pnpm services:*` scripts and `pnpm services:check`. See `docs/engineering/local-development.md`.
- Engineering standards (#16): `docs/engineering/coding-standards.md` and `testing-strategy.md`, linked from AGENTS.md's definition of done.

## Done (M3)

- M3 planned as 12 issues (#52–#63) with acceptance criteria, tests, docs and dependencies. Reconciling the plan found a missing slice (sign-up/log-in/recovery screens, now #57) and settled how the web app and the API share the session cookie (decided in #53).
- Database foundation (#52): `@globetrot/db` has Drizzle tooling, a first migration that enables `postgis`, `pg_trgm` and `unaccent`, a migration runner with an advisory lock (concurrent runners are safe), `migrate`, `reset` and `generate` scripts, a throwaway-database test helper, and a CI job `Integration (Postgres)`. No product tables yet. See `docs/architecture/data-model.md`.
- Web locale integration (#50): `apps/web` uses next-intl with the shared en/pt-BR catalogs. The locale comes from an explicit `globetrot_locale` cookie (set by a server action, `en` fallback) and never from `Accept-Language`, and choosing a language writes nothing about currency, country or nationality. Verified in a browser against the production image. See "Web integration" in `docs/architecture/i18n.md`.

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
   - tokens v1.1 (#5) complete: DTCG theme exports, CSS and TypeScript, contrast checks, handoff inventory and bilingual demo; Storybook primitives (#6) started with a theme/locale toolbar and initial Button stories; Button, text fields, checkbox, switch, select and status marks have initial stories; CI runs axe across stories and keyboard checks on several controls. Remaining components and full interaction/screen-reader testing are pending;
   - missing-screen specs (#7): interaction draft and initial bilingual/theme frames in `docs/design/missing-screens.md`; expanded state coverage, manual checks and owner review remain; usability test (#8): protocol ready in `docs/product/research/usability-01.md`, five real sessions still needed; Pip brief (#9): draft ready for owner approval in `docs/design/pip-character.md`.
2. **M3: App Foundation.** The issues exist (#52–#63, plus #50 done), created from `docs/engineering/m3-foundation-breakdown.md`, which holds the dependency table, the suggested order and the gaps found. #52 (database migrations) is done. Start with **#53** (auth server): it is `agent-ready`. The next-intl item of the breakdown is already done (#50). #62 needs the owner's review of the trip list screen (#7).

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
