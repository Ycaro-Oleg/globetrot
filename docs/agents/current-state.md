# Current state

_Last updated: 2026-11-08, after the documentation audit. Code state: `develop` includes #57 (account screens)._

Read this first. It says where the project is, what exists, what is open, what only the owner can unblock and what to do next. Procedure for working: [`playbook.md`](playbook.md). Feature-by-feature progress: [`../product/progress.md`](../product/progress.md). Milestones and exit criteria: [`../product/roadmap.md`](../product/roadmap.md).

## Snapshot

- **Active milestone: M3 App Foundation.** 8 of 13 issues are done; 5 are open (#55, #59, #60, #62, #63). M2 (engineering foundation) is complete. M0 (product foundation) is complete. **M1 (design system and spikes) is partly open** and its open items need the owner.
- **What works end to end today:** a person can create an account in English or Portuguese, confirm the email through Mailpit, log in, land on a placeholder `/app`, change language, currency, country, nationality, time zone and units, and recover a password. Through the API (no screens yet) a signed-in user can create, list, read, update and archive private trips with idempotent create and an audit trail.
- **What does not exist yet:** the app shell and navigation, the trip list screen, the map board, itinerary, budget, checklists, Pip, passport, landing page, billing, deployment. The domain rules for money, dates, savings, milestones and journey stage are built and tested but not yet wired to screens.
- **Branches:** `main` has no release yet; `develop` is the integration branch. All work goes through `feature/*` or `docs/*` PRs into `develop`.

## Milestone board

| Milestone | State | Open issues | Notes |
|---|---|---|---|
| M0 Product Foundation | **Complete** (the GitHub milestone is still open: the owner decides when to close it) | 0 | Vision, PRD, business rules, roadmap, design audit, ADRs 0001–0009, agent docs |
| M1 Design System & Spikes | **Partly open** | #4, #6, #7, #8, #9 | #2 MapLibre and #3 places spikes and #5 tokens are done. See "Owner-dependent items" |
| M2 Engineering Foundation | **Complete** (closed) | 0 | Monorepo, CI, local services, domain rules (money, trips), i18n, standards |
| **M3 App Foundation** | **Active** | #55, #59, #60, #62, #63 | Done: #50, #52, #53, #54, #56, #57, #58, #61. Plan and dependency table: [`m3-foundation-breakdown.md`](../engineering/m3-foundation-breakdown.md) |
| M4 Travel Workspace & Map | Not started (no issues yet) | — | Needs M3. Issues are created when M3 nears its end |
| M5 Itinerary & Checklists | Not started | — | |
| M6 Budget & Savings | Not started | — | Can run in parallel with M5 |
| M7 Pip v1 | Not started | — | |
| M8 Landing & MVP RC | Not started | — | |
| M9 and later | Not started | — | See the roadmap |

## What exists (by area)

Details live in the owning docs; this is the map.

| Area | State | Owning doc |
|---|---|---|
| Monorepo, CI, Docker images, local services | Done. Dockerfiles for web, api and worker (the worker is a placeholder). CI runs format, lint, typecheck, unit tests, build, integration tests (Postgres + Mailpit) and axe | [`project-structure.md`](../engineering/project-structure.md), [`git-workflow.md`](../engineering/git-workflow.md) |
| Domain (`@globetrot/domain`) | Money (minor units, ISO 4217 registry, FX with provenance, formatting), local dates, trip days, totals, savings plan, nine readiness milestones, journey stage, next steps, trip status constants, ISO 3166 countries, IANA time zones, UUIDv7, password limits | [`money.md`](../architecture/money.md), [`business-rules.md`](../product/business-rules.md) |
| Application (`@globetrot/application`) | Actor, `defineOperation`, typed errors, `assertOwner`, ports, units of work; operations `getCurrentUser`, trips (create, list, get, update, archive), preferences (get, update); `EmailPort` and templates | [`api-contracts.md`](../architecture/api-contracts.md) |
| Database (`@globetrot/db`) | Drizzle; migrations 0000 to 0004; tables `user`, `session`, `account`, `verification`, `rate_limit`, `trip`, `idempotency_key`, `audit_event`, `user_preference`; repositories and the throwaway test database | [`data-model.md`](../architecture/data-model.md) |
| API (`apps/api`) | Hono + OpenAPI. Better Auth at `/api/auth/*`. `/v1`: `me`, `me/preferences`, `trips`, `auth/providers`, `openapi.json`. Problem+json errors, Origin check, rate limits | [`api-contracts.md`](../architecture/api-contracts.md), [`authentication.md`](../architecture/authentication.md) |
| Web (`apps/web`) | next-intl (en, pt-BR); proxy to the API; `/login`, `/signup`, `/recover`, `/reset-password`, `/email-verified`, draft `/terms` and `/privacy`, placeholder `/app`, provisional `/settings`; scaffold home | [`authentication.md`](../architecture/authentication.md#screens-appsweb), [`i18n.md`](../architecture/i18n.md) |
| UI (`@globetrot/ui`) and tokens | Tokens v1.1 (day and red-eye themes); eleven primitives (Button, TextField, Checkbox, Switch, StatusMark, SelectField, Range, Banner, Modal, SegmentedControl, Toast) with stories and axe in CI. More components are part of #6 | [`design-system.md`](../design/design-system.md) |
| i18n (`@globetrot/i18n`) | en and pt-BR catalogs with a CI consistency check; namespaces `status`, `journey`, `milestones`, `nextSteps`, `savings`, `trip`, `webScaffold`, `settings`, `email`, `auth`, `legal`, `app` | [`i18n.md`](../architecture/i18n.md) |
| Spikes | MapLibre (go, with conditions), places on GeoNames + PostGIS (go), geocoding (initial research only) | [`spikes/`](../architecture/spikes/) |

## Owner-dependent items

These cannot be finished by an agent. Do not work around them, and do not mark them done.

| Item | What is needed from the owner | Blocks |
|---|---|---|
| **Confirm the verified-email policy** ([ADR-0012](../architecture/adr/0012-email-delivery-and-verified-sign-in.md)) | Say whether a password sign-in must require a verified email (current default, Google counts as verified), or unverified accounts may enter with a banner | Nothing now; it is a one-line change if the answer is "banner" |
| **Google sign-in credentials (#55)** | A Google OAuth client for a test environment, with the callback URL, supplied through environment variables (never in the repo), and a real-provider smoke test | #55's real-provider verification. The code can be written and tested without them |
| **Screen review (#7)** | Review the missing-screen studies in [`missing-screens.md`](../design/missing-screens.md) and decide | #62 (trip list), and the layout of #59 stays provisional until then |
| **Component and screen-reader review (#6)** | Manual keyboard and screen-reader pass on the Storybook components | Closing #6 |
| **Usability test (#8)** | Five real participants (en and pt-BR) following [`usability-01.md`](../product/research/usability-01.md) | Closing M1; informs the board design |
| **Geocoding provider (#4)** | Provider accounts and keys for quality tests, then a decision | Address search; not needed for city search from GeoNames |
| **Pip brief (#9)** | Approve [`pip-character.md`](../design/pip-character.md) and choose an illustrator | The Pip assets (M7) |
| **Real-device MapLibre test** | Run the frame-rate test on a mid-range Android phone ([`spikes/maplibre.md`](../architecture/spikes/maplibre.md)) | Final go for the board (M4) |
| **Legal text** | Write the Terms of use and the Privacy policy. Until then the pages are marked draft and acceptance is not stored | A public release |
| **Production email provider** | Choose Resend or Postmark, then provide settings and a verified sending domain | Production (M11). SMTP settings are the only change |
| **Pricing, plan limits, regional pricing** | A business decision | M10 |
| **Imagery licensing source** | Choose where destination images come from | Imagery in the board and landing |
| **Close the M0 milestone** | A GitHub setting, so it is the owner's call | Housekeeping only |

## Known gaps and debt

Honest list of what is missing or deliberately simple, so nobody assumes otherwise.

- **Account and data deletion and export** (LGPD/GDPR) are not built and not designed. `audit_event` is append-only and permanent, and `trip.owner_id` is `ON DELETE RESTRICT`, so the design must reconcile both. Required before a public release.
- **Terms acceptance is not stored** (needs the final legal text and a version).
- **Trips: no pagination** (a list returns at most 200), **no delete**, and visibility is always `private`.
- **Idempotency keys are never cleaned up**, and there is no job runner yet (`apps/worker` is a placeholder).
- **No production migration step.** Nothing in the API image runs migrations or ships the `migrations` folder; locally `pnpm --filter @globetrot/db migrate` does it. How migrations run on deploy (app start or a release step) is decided in M11 ([`data-model.md`](../architecture/data-model.md#migrations)).
- **`/health` is shallow:** it answers `ok` without checking the database or the mail server. Add readiness checks with the deployment work (M11).
- **No seed or demo data.** There are no example trips yet (M8) and no script that creates a test account; create one through `/signup` and Mailpit.
- **No end-to-end suite.** The account screens have a real-browser check against a stand-in API (`pnpm --filter @globetrot/web test:a11y`); #63 adds the real journeys.
- **Not verified by a person:** screen readers on any screen; the account screens at very large font sizes in pt-BR; MapLibre on a real phone.
- The client address used for rate limits is only trustworthy behind a trusted edge, and the API must not be reachable from the internet ([`authentication.md`](../architecture/authentication.md#which-client-address-counts-trust-model)).
- `NextIntlClientProvider` ships the whole catalog to the browser (fine for now; see [`i18n.md`](../architecture/i18n.md)).
- Fonts are the system fallback; the brand fonts are not self-hosted yet (with #60).
- Nothing is deployed. There is no CD pipeline, monitoring or backup yet (M11).

## Next

Suggested order, from the [M3 breakdown](../engineering/m3-foundation-breakdown.md):

1. **#59** responsive authenticated shell (rail, phone tab bar, route guards, placeholder-free). Layout is provisional until #7 is reviewed. Replaces the placeholder `/app`.
2. **#55** Google sign-in. The button and the providers query already exist; the code is the provider config and account linking. The real-provider smoke test is the owner's.
3. **#60** theme and motion preferences (after #59).
4. **#62** trip list and switcher, **after the owner reviews #7**.
5. **#63** the first end-to-end and accessibility gate (after the above).
6. When M3 nears its end, plan **M4** (map board) with the owner and create its issues, about 10 to 15 at a time. The roadmap's exit criteria and [`progress.md`](../product/progress.md) say what each milestone must deliver.

In parallel, and owner-driven: the M1 items above. A docs-only PR may fix gaps at any time.

## Decisions taken (summary)

- Stack: TypeScript monorepo, Next.js, Hono, PostgreSQL + PostGIS, Drizzle ([ADR-0002](../architecture/adr/0002-monorepo-and-stack.md)).
- The MVP is a responsive web app/PWA; Expo apps come after the MVP.
- Pip v1 joins the MVP behind a flag (M7). AI is optional and only proposes.
- Protection of `main` and `develop` is by convention plus CI ([ADR-0009](../architecture/adr/0009-git-workflow.md)).
- The web app proxies the API so the session cookie is first-party ([ADR-0010](../architecture/adr/0010-web-proxies-the-api.md)).
- Mutations are one transaction with audit and idempotency ([ADR-0011](../architecture/adr/0011-idempotency-audit-and-units-of-work.md)).
- Email goes through a port and SMTP; a password sign-in needs a verified address ([ADR-0012](../architecture/adr/0012-email-delivery-and-verified-sign-in.md)).
- The Stripe account is in Brazil ([`stripe.md`](../integrations/stripe.md)). Pricing is mocked until approved.
- The passport belongs to the account, with a visa page per trip ([business rules](../product/business-rules.md#passport)).
- Language, currency, country, nationality and time zone are independent, and USD is the default currency.

## Open decisions

- Pricing and plan limits (before M10).
- Production email provider (Resend or Postmark).
- Managed geocoding provider (#4).
- Pip illustrator and asset timeline.
- Imagery licensing source.
- Account and data deletion design and retention (before a public release).
- Whether to keep `audit_event` metadata to field names only, or add values with a retention policy ([ADR-0011](../architecture/adr/0011-idempotency-audit-and-units-of-work.md)).

## Blockers

No technical blocker for the next M3 issues (#59, #55 code, #60). #62 waits for the owner's review of #7. See "Owner-dependent items".
