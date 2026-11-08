# Current state

_Last updated: 2026-11-07, after the account screens (#57)._

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

- Auth server (#53): Better Auth in `apps/api` (email and password, database sessions, rate limits in Postgres, own Origin check against login CSRF), auth tables in migration `0001`, and `apps/web/proxy.ts` forwarding `/api/auth/*` so the session cookie is first-party. Config is validated at startup (production refuses a missing or default secret). The API bundle is built with a `createRequire` banner for CommonJS deps. Verified end to end on the built images. See `docs/architecture/authentication.md`, including the client-address trust model: the API must stay private behind the web app and a trusted edge.
- Authenticated API (#56): `packages/application` has the `Actor`, the operation convention (`defineOperation`: Zod in and out, output parsed so nothing extra leaks), typed errors, `assertOwner` and the first query `getCurrentUser`, behind ports. `apps/api` builds the actor from the session cookie only, serves `GET /v1/me` and `GET /v1/openapi.json`, and answers every error as problem+json. `packages/api-client` has the generated typed client (committed; two tests fail when stale, `pnpm api:generate` refreshes). The web proxy forwards `/v1/*` too. See `docs/architecture/api-contracts.md`.
- Trip persistence (#61): `trip`, `idempotency_key` and append-only `audit_event` tables (migrations 0002 and 0003, with CHECK constraints from the domain lists). Operations `createTrip`, `listTrips`, `getTrip`, `updateTrip` and `archiveTrip` (no delete) behind `/v1/trips`, as the session's actor only; another user's trip is a 404 identical to a missing one. `createTrip` honours `Idempotency-Key` (same key and request returns the original, a different request is a 409, concurrent duplicates create one). Mutations run in one transaction (`UnitOfWork`) with their audit event, which carries field names and no personal data. Ports and in-memory fakes in `@globetrot/application` (`/testing`), SQL in `packages/db/src/repositories.ts`, UUIDv7 in the domain. See `docs/architecture/api-contracts.md` and `data-model.md`.
- Preferences (#58): `user_preference` table (migration 0004) with `locale`, `currency` (default USD), `homeCountry`, `nationality`, `timeZone` and `units`, all independent. `getPreferences` and `updatePreferences` (partial, audited by field name) behind `GET` and `PATCH /v1/me/preferences`. A sign-up hook stores the language from the `globetrot_locale` cookie and nothing else. The web app uses the stored language and time zone for signed-in users (cookie stays the anonymous fallback) and has a provisional `/settings` page built with `@globetrot/ui` (en and pt-BR). New domain helpers: ISO 3166 country codes, IANA time zones, unit systems. See `docs/architecture/i18n.md` and `data-model.md`.
- Email verification and recovery (#54): `EmailPort` with plain-text and HTML templates in en and pt-BR (the `email` catalog namespace), an SMTP adapter (nodemailer) that targets Mailpit locally, and Better Auth wiring. A password sign-in now requires a verified email (`403 EMAIL_NOT_VERIFIED`; `REQUIRE_VERIFIED_EMAIL=false` turns it off), and sign-up no longer returns a session. Reset links work once, last an hour and revoke every session. Resend and reset answer the same for known and unknown addresses, with a 30 s per-address cooldown (`429` with `Retry-After`) and a per-client limit. Integration tests read the mail from Mailpit, which CI now runs as a service. See `docs/architecture/authentication.md`.
- Account screens (#57): `/login`, `/signup`, `/recover`, `/reset-password`, `/email-verified`, draft `/terms` and `/privacy`, and a placeholder `/app`, built with `@globetrot/ui` in en and pt-BR. Password strength meter, loading and error states with stable-code messages, a resend countdown, a language switcher, and a Google button that appears only when `GET /v1/auth/providers` lists it (it lists nothing until #55). `next` accepts only same-site paths; an anonymous `/app` goes to `/login?next=…`. From the UI alone: sign up, verify through Mailpit, log in, land on `/app`. A browser check against a stand-in API (CI job `Accessibility (axe)`) covers every state, the keyboard path, the redirects and axe in both themes and languages. See `docs/architecture/authentication.md`.

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
2. **M3: App Foundation.** The issues exist (#52–#63, plus #50 done), created from `docs/engineering/m3-foundation-breakdown.md`, which holds the dependency table, the suggested order and the gaps found. #52 (database migrations) is done. #53 (auth server) is done; next are **#55** (Google), **#59** (the authenticated shell) and **#62** (trip list, after your review of #7); The trip list and switcher (#62) wait for the owner's screen review (#7). The next-intl item of the breakdown is already done (#50). #62 needs the owner's review of the trip list screen (#7).

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
- Production email provider (Resend vs Postmark). The SMTP adapter works with either; only `SMTP_*` settings change.
- Owner to confirm the #54 default: a verified email is required for password sign-in (Google counts as verified).
- Managed geocoding provider (in the M1 spike).
- Pip Rive illustrator / asset timeline.
- Imagery licensing source.

## Blockers

None.
