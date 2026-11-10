# Current state

_Last updated: 2026-11-09, after the trip screens, the landing page and the starter board. Code state: `develop` includes #62 (PR #76)._

Read this first. It says where the project is, what exists, what is open, what only the owner can unblock and what to do next. Procedure for working: [`playbook.md`](playbook.md). Feature-by-feature progress: [`../product/progress.md`](../product/progress.md). Milestones and exit criteria: [`../product/roadmap.md`](../product/roadmap.md).

## Snapshot

- **Active milestone: M3 App Foundation.** 10 of 13 issues are done; 3 are open (#55, #60, #63). M2 (engineering foundation) is complete. M0 (product foundation) is complete. **M1 (design system and spikes) is partly open** and its open items need the owner.
- **What works end to end today** (checked against the real API, Postgres and Mailpit): a person can see the landing page, create an account in English or Portuguese, confirm the email through Mailpit, log in, create a trip, see it in the list and switcher, archive it and undo, open the world-map board, search places, pin a route, change language, currency, country, nationality, time zone and units, recover a password and log out.
- **The map board is a starter** (#75): MapLibre with Geoapify tiles, place search and a route, but the stops are kept **in the browser only** (`localStorage`), not on the trip. Persisting them, the mobile bottom sheet, the stop panel and a server-side geocoder are M4.
- **The landing page is a first version** (#74): no pricing section and no example trips yet.
- **What does not exist yet:** itinerary, budget, checklists, Pip, passport, example trips, billing, deployment. The domain rules for money, dates, savings, milestones and journey stage are built and tested but not wired to screens.
- **Branches:** `main` has no release yet; `develop` is the integration branch. All work goes through `feature/*` or `docs/*` PRs into `develop`.

## Milestone board

| Milestone | State | Open issues | Notes |
|---|---|---|---|
| M0 Product Foundation | **Complete** (the GitHub milestone is still open: the owner decides when to close it) | 0 | Vision, PRD, business rules, roadmap, design audit, ADRs 0001–0009, agent docs |
| M1 Design System & Spikes | **Partly open** | #4, #6, #7, #8, #9 | #2 MapLibre and #3 places spikes and #5 tokens are done. The owner approved the trip list/switcher portion of #7; other studies and checks remain. |
| M2 Engineering Foundation | **Complete** (closed) | 0 | Monorepo, CI, local services, domain rules (money, trips), i18n, standards |
| **M3 App Foundation** | **Active** | #55, #60, #63 | Done: #50, #52, #53, #54, #56, #57, #58, #59, #61, #62. Plan and dependency table: [`m3-foundation-breakdown.md`](../engineering/m3-foundation-breakdown.md) |
| M4 Travel Workspace & Map | **Started** (starter board, #75) | #75 | Needs M3 to finish. Map, search and a local route exist; persistence on the trip, mobile sheet and the rest are open. More issues are created when M3 nears its end |
| M5 Itinerary & Checklists | Not started | — | |
| M6 Budget & Savings | Not started | — | Can run in parallel with M5 |
| M7 Pip v1 | Not started | — | |
| M8 Landing & MVP RC | **Started** (first landing, #74) | #74 | Pricing mock, example trips, SEO, performance and legal pages are open |
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
| Web (`apps/web`) | next-intl (en, pt-BR); proxy to the API; public landing `/`; `/login`, `/signup`, `/recover`, `/reset-password`, `/email-verified`, draft `/terms` and `/privacy`; the `/app` shell (rail, tab bar, account menu, trip switcher); `/app/trips` and `/app/trips/[id]` (list, filters, create, archive and undo, overview); `/app/board` (starter map); placeholder pages for days, budget, lists, passport; `/app/pip` behind `FEATURE_PIP`; provisional `/settings`. Brand fonts are self-hosted | [`authentication.md`](../architecture/authentication.md#screens-appsweb), [`design-system.md`](../design/design-system.md), [`i18n.md`](../architecture/i18n.md) |
| UI (`@globetrot/ui`) and tokens | Tokens v1.1 (day and red-eye themes); eleven primitives (Button, TextField, Checkbox, Switch, StatusMark, SelectField, Range, Banner, Modal, SegmentedControl, Toast) with stories and axe in CI. More components are part of #6 | [`design-system.md`](../design/design-system.md) |
| i18n (`@globetrot/i18n`) | en and pt-BR catalogs with a CI consistency check; namespaces `status`, `journey`, `milestones`, `nextSteps`, `savings`, `trip`, `webScaffold`, `settings`, `email`, `auth`, `legal`, `app`, `shell`, `tripWorkspace`, `landing`, `mapBoard` | [`i18n.md`](../architecture/i18n.md) |
| Spikes | MapLibre (go, with conditions), places on GeoNames + PostGIS (go), geocoding (initial research only) | [`spikes/`](../architecture/spikes/) |

## Owner-dependent items

These cannot be finished by an agent. Do not work around them, and do not mark them done.

| Item | What is needed from the owner | Blocks |
|---|---|---|
| **Confirm the verified-email policy** ([ADR-0012](../architecture/adr/0012-email-delivery-and-verified-sign-in.md)) | Say whether a password sign-in must require a verified email (current default, Google counts as verified), or unverified accounts may enter with a banner | Nothing now; it is a one-line change if the answer is "banner" |
| **Google sign-in credentials (#55)** | A Google OAuth client for a test environment, with the callback URL, supplied through environment variables (never in the repo), and a real-provider smoke test | #55's real-provider verification. The code can be written and tested without them |
| **Remaining screen review (#7)** | Review the rest of the missing-screen studies in [`missing-screens.md`](../design/missing-screens.md); the trip list/switcher has been approved | Other M3/M6 screen designs and final #7 closure |
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
- **The board's stops live only in the browser** (`localStorage` key in `world-map.tsx`), so they are lost on another device or after clearing site data. The Geoapify key is a **public** browser key written into the bundle at build time (`NEXT_PUBLIC_GEOAPIFY_API_KEY`); it must be restricted to the site's domains in the Geoapify dashboard, and address search should move behind the server-side `GeocodingPort` (#75).
- **An unknown or foreign trip id shows a "not found" page with status 200**, not a 404 (the loading boundary has already sent the status). Harmless; fix if it matters for monitoring.
- **Light surfaces inside the red-eye theme** (auth panel, board cards, landing cream sections, trip cards) are hard-coded light and use the `always-light` token overrides; any new light surface must do the same or axe fails on contrast in the red-eye theme.
- **No end-to-end suite.** The account screens and the shell have a real-browser check against a stand-in API (`pnpm --filter @globetrot/web test:a11y`: five widths, both themes and languages, keyboard, account menu, Pip flag on and off); #63 adds the real journeys.
- **The shell's pages are still placeholders.** Board, Days, Budget, Lists and Passport are not built yet; #62 adds the Trips list and overview on this branch. Pip's page exists only behind `FEATURE_PIP`. There is no theme switch yet (#60).
- **Not verified by a person:** screen readers on any screen (including the shell's navigation and account menu); the shell on a real phone (safe-area, on-screen keyboard); the account screens at very large font sizes in pt-BR; MapLibre on a real phone.
- The client address used for rate limits is only trustworthy behind a trusted edge, and the API must not be reachable from the internet ([`authentication.md`](../architecture/authentication.md#which-client-address-counts-trust-model)).
- `NextIntlClientProvider` ships the whole catalog to the browser (fine for now; see [`i18n.md`](../architecture/i18n.md)).
- Fonts are the system fallback; the brand fonts are not self-hosted yet (with #60).
- Nothing is deployed. There is no CD pipeline, monitoring or backup yet (M11).

## Next

Suggested order, from the [M3 breakdown](../engineering/m3-foundation-breakdown.md):

1. **#63** the first end-to-end and accessibility gate. A real-browser journey against the real stack already passes locally (sign-up, email, log-in, trip, archive and undo, board, log-out; the throwaway script is not in the repo); #63 turns it into a CI job and a committed test.
2. **#60** theme and motion preferences. The fonts are already self-hosted; what remains is the day / red-eye / system switch, persistence and full / reduced motion.
3. **#55** Google sign-in; the real-provider smoke test still needs the owner's OAuth credentials.
4. **M4** (map board): the starter exists (#75). Create the M4 issues with the owner (persist destinations and pins on the trip, server-side geocoding, mobile sheet, stop panel), about 10 to 15 at a time. The roadmap's exit criteria and [`progress.md`](../product/progress.md) say what each milestone must deliver.
5. **M8**: finish the landing (#74) when M4 to M7 are further along.

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

No technical blocker for the next M3 issues (#63, #60, #55 code).
