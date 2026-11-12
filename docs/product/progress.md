# Progress: PRD features and what is built

One row per feature of the [PRD](prd.md), with where it stands, the issues, and where it is documented. Update the row in the PR that changes it. The big picture is in [`../agents/current-state.md`](../agents/current-state.md); milestones and exit criteria are in the [roadmap](roadmap.md).

**Status values:** `Done` (built, tested, documented), `Partial` (some layers done), `Not started`, `Blocked` (waiting on the owner). "Built" says what exists; the PRD row says what the MVP needs.

## Essential MVP

| Feature (PRD) | Milestone | Status | Built so far | Left | Issues | Docs |
|---|---|---|---|---|---|---|
| Auth: email and password, recovery | M3 | **Done** | Better Auth, sessions, verified email, reset, rate limits, screens in en and pt-BR | — | #53, #54, #57 | [authentication](../architecture/authentication.md), ADR-0005, 0010, 0012 |
| Auth: Google sign-in | M3 | **Done in code** | Better Auth Google provider behind `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, linking only on verified addresses on both sides, failures to `/login?error=`, the button and the error message in en and pt-BR, integration tests with a stubbed Google; the real authorization URL was checked with the owner's test client | The owner's real-provider smoke run ([checklist](../architecture/authentication.md#manual-smoke-checklist-the-owners-with-real-credentials)) | #55 | [authentication](../architecture/authentication.md#google-sign-in-55) |
| i18n en and pt-BR, locale formatting | M3 to M8 | Partial | Catalogs and CI check, web integration, formatters, account, settings and email copy | Copy for every later feature, as each is built; the landing in M8 | #15, #50 | [i18n](../architecture/i18n.md), ADR-0008 |
| Preferences: language, currency (USD default), country, nationality, time zone, units | M3 | **Done** | Table, API, `/settings` page, sign-up language | — | #58 | [data-model](../architecture/data-model.md#user-preferences), [business rules](business-rules.md#locale-and-currency) |
| Preferences: theme and motion | M3 | **Done** | `theme` (day, red-eye, system) and `motion` (full, reduced) stored with the settings and in cookies, rendered on `<html>` by the server (no flash), the head script for `system`, the OS reduced-motion rule, the Appearance controls in `/settings` | The landing page still has its own day/night switch (#74) | #60 | [design-system](../design/design-system.md#theme-and-motion-how-they-are-initialised-60), [data-model](../architecture/data-model.md#user-preferences) |
| Multiple trips: list, create, switch, archive | M3 | **Done** | Table, operations and API (create, list, get, update, archive) with idempotency and audit; the bilingual list with status filters, create form, archive with undo, a persisted current-trip switcher and a small overview, all checked against the real API | The overview grows with the board, days and budget (M4 onwards) | #61, #62 | [api-contracts](../architecture/api-contracts.md), [business rules](business-rules.md#trips), [missing-screens](../design/missing-screens.md) |
| Responsive authenticated shell | M3 | **Done** | Desktop rail, tablet icon rail, phone top bar and five-tab bar, account menu with log out, trip switcher, skip link and focus rings, loading and error states, Pip entry points behind `FEATURE_PIP`, route guard on every `/app` page, axe in both themes and languages at five widths | Placeholder pages are replaced as each feature lands; layout stays provisional for the parts of #7 the owner has not reviewed | #59 | [design-system](../design/design-system.md#the-shell-as-built-59) |
| Map board: world to region, stops, airmail route, stop panel, city search | M4 | **Partial** (#75) | MapLibre map with Geoapify tiles, place search, tools Select, Pin and Thread, an ordered route and a Japan sample, place detail. **The route is saved to the trip** (`destination` table, `GET`/`PUT /v1/trips/{id}/destinations`) and reloads on the next visit | Pins and `PinConnection`, stop panel (nights, notes, costs), reorder and undo, the world-to-region transition, mobile sheet, server-side `GeocodingPort` | #2, #3 done; #75 open; #4 open | [ADR-0003](../architecture/adr/0003-map-stack.md), [data-model](../architecture/data-model.md#destinations-a-trips-route) |
| Mobile board: bottom sheet, crosshair "Pin here" | M4 | Not started | Interaction spec in the handoff | Everything; real-device frame-rate test (owner) | — | [design-audit](../design/design-audit.md) |
| Itinerary by days, accessible drag and drop | M5 | **Partial** | `tripDays` in the domain; **nights per stop** are edited on the board (stepper, 44px targets) and saved with the route; the **Days page** shows one day per night grouped by stop, with real dates once the trip has a start date, in both languages | Activities and places per day, keyboard and pointer drag and drop between days, editing the start date | — | [business rules](business-rules.md#trips), [data-model](../architecture/data-model.md#destinations-a-trips-route) |
| Checklists | M5 | Not started | Milestone rules (`docs`, `check`) in the domain | Persistence and screens | — | [business rules](business-rules.md#readiness-milestones-trip-visa-page-stamps) |
| Multi-currency budget with FX provenance | M6 | **Partial** (v1 live) | Costs per trip with category and status, a currency per cost, **conversion at a rate you type, kept with its source and day**, totals by category and status in the trip's currency, the trip's currency locked once money is in it; the Budget page with the forms, in both languages | A rates source (live or daily rates) instead of typing the rate, per-stop costs, an expense-entry design review (#7), editing a cost in place | — | [money](../architecture/money.md), [data-model](../architecture/data-model.md#budget-expenses-and-savings), [business rules](business-rules.md#budget) |
| Savings plan and answer sentence | M6 | **Done** (v1) | `savingsPlan` drives the sentence on the Budget page: yes with the month, almost (after leaving), what to put aside to leave on time, nothing to save for, fully saved; a progress bar; saved and monthly amounts saved per trip | Scenarios (what if I save more), editing the start date | #14, #15 done | [business rules](business-rules.md#savings-plan) |
| Readiness stamps (visa page) and celebration | M5 | Partial | `milestones` and `recordStamps` in the domain | Persistence, the visa page, the celebration | #14 done | [business rules](business-rules.md#readiness-milestones-trip-visa-page-stamps) |
| Example trips (duplicable) | M8 | Not started | — | Content and duplication | — | — |
| Light and dark themes | M3 | **Done** | Tokens for both, contrast checks, stories in both, every built screen passes axe in both themes, the switch and its persistence (#60) | The landing page's night palette (#74) | #5, #60 | [design-system](../design/design-system.md) |
| Landing with **mock** pricing | M8 | **Partial** (first version, #74) | Hero, how it works, the answer sentence, Pip, examples and footer in en and pt-BR, both themes, axe clean | Mock pricing from configuration, example trips, SEO and social images, legal pages, performance run, owner review | #74 | [stripe](../integrations/stripe.md) |
| Pip v1 behind a feature flag | M7 | Not started | The `FEATURE_PIP` flag and its entry points (#59); brief drafted (needs approval) | `AIProposal`, change list, apply and undo, cost limits | #9 open | [ADR-0007](../architecture/adr/0007-ai-provider-abstraction.md), [pip-character](../design/pip-character.md) |

## Initial public release

| Feature | Milestone | Status | Notes |
|---|---|---|---|
| Account passport and self-declared place stamps, basic profile | M9 | Not started | Rules in [business rules](business-rules.md#passport) |
| Stripe subscriptions and entitlements | M10 | Not started | Test mode only; pricing is the owner's decision. [stripe](../integrations/stripe.md) |
| PWA offline trip pack | After M8 | Not started | Needs map tiles |
| Production deployment (Hetzner and Coolify), backups, monitoring | M11 | Not started | Dockerfiles exist; nothing is deployed |
| Account data export and deletion | Before the public release | Not started and not designed | Required by LGPD/GDPR. See "Known gaps" in [current-state](../agents/current-state.md) |

## Post-launch and experimental

Social, ranks, native apps, the MCP server, real routing and the experimental items are not started and not scoped. They are in the [PRD](prd.md) and the [roadmap](roadmap.md). The architecture already prepares for them: the application layer, ports, audit, idempotency and the actor model ([ADR-0006](../architecture/adr/0006-api-and-application-layer.md), [ADR-0011](../architecture/adr/0011-idempotency-audit-and-units-of-work.md)).

## Cross-cutting

| Concern | Status | Notes |
|---|---|---|
| Accessibility (WCAG 2.2 AA) | Partial | axe runs on every Storybook story and every account-screen state, in both themes and languages. No screen-reader or real-device review yet (owner-dependent) |
| Tests | Partial | Unit, property, integration (Postgres and Mailpit), a browser check of the account screens. No end-to-end suite yet (#63) |
| Security | Partial | Origin check, rate limits, non-enumerating recovery, append-only audit, secrets only in the environment. No security review yet (M11) |
| Documentation | Maintained | `pnpm docs:check` runs in CI. See [`../agents/playbook.md`](../agents/playbook.md#which-docs-to-update) |
