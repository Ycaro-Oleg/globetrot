# Context map

Read only what your task needs. Always start with [`current-state.md`](current-state.md) and your issue. How to run a session: [`playbook.md`](playbook.md). Unfamiliar word: [`../glossary.md`](../glossary.md).

All paths below are relative to `docs/` unless they start with `apps/`, `packages/`, `infra/` or `.github/`. "Handoff" means [`design/reference/claude-design-v1/README.md`](../../design/reference/claude-design-v1/README.md), and the `atlas/*` files live in the same folder.

## By task type

| Task type | Read | Skim if needed |
|---|---|---|
| **Any task** | `AGENTS.md`, `agents/current-state.md`, `agents/playbook.md`, the issue | `README.md` (the docs index), `glossary.md` |
| **Any code change** | `engineering/coding-standards.md`, `engineering/testing-strategy.md` (the "What each change must test" table) | `engineering/project-structure.md`, `engineering/configuration.md` |
| **Starting or finishing a PR** | `agents/playbook.md`, `engineering/git-workflow.md`, `.github/pull_request_template.md` | `agents/handoff.md` |
| **Docs-only change** | `agents/playbook.md` (Which docs to update), `README.md` (index), ADR-0001 (language policy) | Run `pnpm docs:check` |
| **Map / board** | ADR-0003, `architecture/spikes/maplibre.md`, `architecture/spikes/places.md` and `architecture/spikes/geocoding.md` (findings), `design/design-system.md` (responsive and accessibility), `architecture/domain-model.md` (Trip Planning, Geo) | Handoff "Board", "Map pin" and "Route" sections, `atlas/map.js` |
| **Trips (persistence, lifecycle)** | `product/business-rules.md` (Trips), `architecture/api-contracts.md` (trips, idempotency, audit), `architecture/data-model.md` (Trips, idempotency and audit), ADR-0011 | `packages/application/src/trips`, `packages/db/src/{schema/trip,repositories}.ts`, `apps/api/src/routes/trips.ts` |
| **Itinerary / checklists** | `product/business-rules.md` (Trips, Readiness), `architecture/domain-model.md` | Handoff "Itinerary" and "Checklists" sections |
| **Budget / savings / currency** | `product/business-rules.md` (Locale and currency, Budget, Savings), `architecture/money.md`, ADR-0004 | `atlas/app-core.js` (totals, plan), `packages/domain/src/money`, `packages/domain/src/trip/savings.ts` |
| **i18n / copy** | `architecture/i18n.md`, ADR-0008 | `packages/i18n/messages/*.json` |
| **Preferences (language, currency, country, time zone)** | `product/business-rules.md` (Locale and currency), `architecture/data-model.md` (User preferences), `architecture/i18n.md` (Web integration), `design/missing-screens.md` (Language and region) | `packages/application/src/preferences`, `apps/api/src/routes/preferences.ts`, `apps/web/app/settings`, `apps/web/i18n/request.ts` |
| **Auth, sessions, sign-in** | ADR-0005, ADR-0010, `architecture/authentication.md`, `product/business-rules.md` (Accounts) | `apps/api/src/{config,auth,app}.ts`, `apps/web/proxy.ts`, `packages/db/src/schema/auth.ts` |
| **Account screens (log in, sign up, recover, reset)** | `architecture/authentication.md` (Screens, Redirect rules), `design/design-system.md` (account screen patterns), `design/design-audit.md`, Handoff "Auth" | `apps/web/app/(auth)`, `apps/web/lib/{auth-client,auth-errors,safe-next,password-strength}.ts`, `apps/web/scripts/check-auth-pages.mjs` |
| **Account data (export, deletion, trip deletion)** | ADR-0015, `product/business-rules.md` (Privacy), `architecture/api-contracts.md` | `packages/application/src/account`, `packages/db/src/account-repository.ts`, `apps/api/src/routes/account.ts`, `apps/web/app/settings/your-data.tsx` |
| **Photos (uploads, storage, metadata)** | ADR-0014, `product/business-rules.md` (Photos), `architecture/data-model.md` (Media) | `packages/domain/src/media.ts`, `packages/application/src/media`, `apps/api/src/{storage,routes/media}.ts`, `apps/web/lib/upload.ts`, `apps/web/app/app/_components/photo-picker.tsx` |
| **Community (posts, comments, follows, moderation)** | ADR-0013, `product/business-rules.md` (Community), `architecture/data-model.md` (Community), `architecture/api-contracts.md` (community rows) | `packages/domain/src/community.ts`, `packages/application/src/community`, `packages/db/src/community-repository.ts`, `apps/api/src/routes/community.ts`, `apps/web/app/app/community` |
| **Email (verification, reset, templates)** | ADR-0012, `architecture/authentication.md` (Email verification and recovery), `architecture/i18n.md` (Email) | `packages/application/src/email`, `apps/api/src/{auth,email}.ts`, `apps/api/src/testing/mailpit.ts` |
| **API / application layer** | ADR-0006, ADR-0011, `architecture/api-contracts.md`, `architecture/domain-model.md` (conventions) | `packages/application/src`, `apps/api/src/{app,wire,problem}.ts`, `packages/api-client` |
| **Database / migrations** | `architecture/data-model.md`, ADR-0002, ADR-0006, ADR-0011 | `packages/db/migrations`, `engineering/local-development.md` (Database) |
| **Design system / UI component** | `design/design-system.md`, `design/design-audit.md` | Handoff tokens and components, `atlas/globetrot.css`, `packages/ui/src` |
| **Landing page** | `design/design-audit.md`, `integrations/stripe.md` (mock pricing), `architecture/i18n.md` | `Globetrot - Landing.html` in the handoff |
| **Pip / AI** | ADR-0007, `product/business-rules.md` (AI), `design/pip-character.md` | Handoff "Pip" section, `atlas/app-core.js` (change lists), `atlas/pip.js` |
| **Passport / stamps / ranks** | `product/business-rules.md` (Readiness, Passport, Progression) | — |
| **Stripe / billing** | `integrations/stripe.md`, `product/business-rules.md` | — |
| **MCP** | `integrations/mcp.md`, ADR-0006, ADR-0007, ADR-0005 | — |
| **Accessibility / testing** | `engineering/testing-strategy.md`, `design/design-system.md` (Accessibility) | `packages/ui/scripts/check-a11y.mjs`, `apps/web/scripts/check-auth-pages.mjs` |
| **Repo / CI / workflow** | `engineering/git-workflow.md`, `engineering/project-structure.md`, ADR-0009 | `.github/workflows/ci.yml`, `turbo.json`, `eslint.config.mjs` |
| **Configuration / environment variables** | `engineering/configuration.md`, `engineering/local-development.md` | `.env.example`, `compose.yaml`, `apps/api/src/config.ts`, `packages/db/src/config.ts` |
| **Local environment / services** | `engineering/local-development.md` | `compose.yaml`, `infra/` |
| **Adding a package or app** | `engineering/project-structure.md`, `architecture/overview.md` | ADR-0002, ADR-0006 |
| **Infra / deployment** | `architecture/overview.md` (Deployment shape) | Future `infrastructure/*` docs (M11) |
| **Planning a milestone** | `product/roadmap.md`, `product/progress.md`, `product/prd.md`, `engineering/m3-foundation-breakdown.md` (as a model of a breakdown), `engineering/git-workflow.md` (Issues) | `agents/current-state.md` (owner-dependent items) |
| **Product questions** | `product/vision.md`, `product/prd.md`, `product/business-rules.md`, `product/progress.md` | `design/design-audit.md` |
| **Usability research** | `product/research/usability-01.md`, `design/design-audit.md` | The prototype in the handoff |

## Where to find a decision

| You are asking | Look in |
|---|---|
| Why this stack, auth, API shape, i18n, map, workflow? | [`architecture/adr/`](../architecture/adr/README.md) |
| What is the rule for X (money, savings, stamps, privacy)? | `product/business-rules.md` |
| What does the API do, and how do I add an endpoint? | `architecture/api-contracts.md` |
| What is stored where? | `architecture/data-model.md` |
| Which environment variable does Y? | `engineering/configuration.md` |
| What is decided, open or waiting on the owner? | `agents/current-state.md` |
| What is built for a PRD feature? | `product/progress.md` |
