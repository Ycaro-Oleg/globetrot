# Glossary

The words this project uses, and what each one means here. Use them exactly: the code, the docs and the issues all rely on them, and a synonym creates bugs. Each entry says where the full rule lives.

## Product

| Term | Meaning | Owner doc |
|---|---|---|
| **Trip** | One journey a user plans. Private to its owner. Has a title, an optional start date, a currency and an explicit **status** | [business rules](product/business-rules.md#trips) |
| **Status** (of a trip) | Set by the user: `active`, `traveling`, `completed` or `archived`. Never derived. Archiving hides a trip, it does not delete it | [business rules](product/business-rules.md#trips) |
| **Stage** (of a trip) | Derived, never stored: `dream → explore → connect → plan → save → prepare → ready`. The first unmet station. Not the same thing as status | [business rules](product/business-rules.md#trips) |
| **Stop** (destination) | An ordered place on the route, with nights ≥ 0. `planned` or `draft` (a Pip proposal not yet applied) | [domain model](architecture/domain-model.md) |
| **Pin** | Any other marker on the board (place, stay, transport hub, custom, note) | [domain model](architecture/domain-model.md) |
| **Connection** | A first-class link between two pins (`sequence`, `alternate`, `custom`). Conceptual, not a real road route | [business rules](product/business-rules.md#trips) |
| **Board** | The interactive map workspace. The flagship feature. Every action on it also has a non-map path | [vision](product/vision.md) |
| **Airmail route** | The drawn route on the board: three strokes on an arc with moving stripes | [design audit](design/design-audit.md) |
| **Answer sentence** | The one-line budget answer: "Yes, by April 2027, if you put aside X a month." | [business rules](product/business-rules.md#savings-plan) |
| **Estimate / confirmed / paid / unknown** | The four statuses of an expense, always shown as glyph plus word (`≈ ✓ ● ?`) | [business rules](product/business-rules.md#budget) |
| **Stamp** | A readiness milestone earned once and never taken back. Nine per trip | [business rules](product/business-rules.md#readiness-milestones-trip-visa-page-stamps) |
| **Visa page** | The page of the passport that belongs to one trip and holds its readiness stamps | [business rules](product/business-rules.md#passport) |
| **Passport** | Belongs to the **account**. Decorative and fictional, never an official document. Place stamps are `self-declared` | [business rules](product/business-rules.md#passport) |
| **Pip** | The optional AI companion. Only proposes a **change list**; the user previews, edits, applies and can undo | [business rules](product/business-rules.md#ai-pip) |
| **Change list** | Pip's structured output: reviewable items, applied selectively, undoable. Never free prose that edits data | [ADR-0007](architecture/adr/0007-ai-provider-abstraction.md) |
| **Preferred currency** | The user's default for new trips. Not the trip's currency, not the payment currency, and never inferred | [business rules](product/business-rules.md#locale-and-currency) |
| **Trip currency** | The currency a trip is budgeted in. Defaults to the preferred currency; can be changed | [money](architecture/money.md) |
| **Sign-up language** | The language the person was using when the account was created, read from the language cookie. Nothing else is inferred from it | [authentication](architecture/authentication.md#the-sign-up-language) |
| **Mock pricing** | Placeholder plans shown on the landing, clearly labelled. No real charge exists until M10 | [stripe](integrations/stripe.md) |

## Architecture

| Term | Meaning | Owner doc |
|---|---|---|
| **Domain** (`packages/domain`) | Pure rules: no I/O, no clock, no framework, relative imports only. Money, dates, totals, savings, milestones, ids | [overview](architecture/overview.md) |
| **Application** (`packages/application`) | Commands and queries with Zod schemas, authorization, idempotency and audit. Talks to the world only through **ports** | [api contracts](architecture/api-contracts.md) |
| **Operation** | One command (writes) or query (reads), defined with `defineOperation`. Web, Pip, the future MCP server and jobs all call the same operations | [api contracts](architecture/api-contracts.md#operations-packagesapplication) |
| **Actor** | Who performs an operation. Today `{ kind: 'user', userId }`, built only from the verified session cookie. No request field can name it | [api contracts](architecture/api-contracts.md#who-is-calling-the-actor) |
| **Port** | An interface the application needs from the outside (storage, email, clock, ids). Adapters implement it; tests use in-memory fakes | [api contracts](architecture/api-contracts.md#operations-packagesapplication) |
| **Adapter** | Code that implements a port or exposes the application: Hono routes, Drizzle repositories, the SMTP sender | [overview](architecture/overview.md) |
| **Unit of work** | One transaction that commits or rolls back together: the change, its audit event and its idempotency record | [ADR-0011](architecture/adr/0011-idempotency-audit-and-units-of-work.md) |
| **Idempotency key** | A client-chosen `Idempotency-Key` that makes a retried `POST` safe. Same key and request returns the original; another request is a 409 | [api contracts](architecture/api-contracts.md#idempotency-mutations) |
| **Audit event** | An append-only record of a mutation: actor, action, entity, time, and the *names* of changed fields, never their values | [data model](architecture/data-model.md#trips-idempotency-and-audit) |
| **Problem+json** | The error format of every `/v1` response (RFC 9457), with a stable `code` clients switch on | [api contracts](architecture/api-contracts.md#errors-applicationproblemjson) |
| **Stable code** | A machine-readable error code (`UNAUTHENTICATED`, `INVALID_TOKEN`, …). Screens map codes to translated messages and never show server text | [authentication](architecture/authentication.md#error-codes) |
| **First-party cookie** | The session cookie belongs to the web origin because the web app proxies `/api/auth/*` and `/v1/*` to the API | [ADR-0010](architecture/adr/0010-web-proxies-the-api.md) |
| **Trust model** (client address) | Rate limits use the leftmost `X-Forwarded-For`. The API must stay private behind the web app and a trusted edge | [authentication](architecture/authentication.md#which-client-address-counts-trust-model) |
| **Contract** | The OpenAPI document (`packages/api-client/openapi.json`) and the typed client generated from it. Two tests fail while they are stale | [api contracts](architecture/api-contracts.md#versioning) |
| **Migration** | A forward-only SQL file in `packages/db/migrations`. Never edit one that has been applied anywhere | [data model](architecture/data-model.md#migrations) |
| **Expand / contract** | Deploying a schema change in two releases so the old app version keeps working while the migration runs | [data model](architecture/data-model.md#migrations) |
| **Minor units** | Money stored as an integer count of the smallest unit (cents) plus an ISO 4217 code. Never floats | [money](architecture/money.md) |
| **Local date** | A calendar date with no time zone (`2027-04-03`) for trips and itineraries. Timestamps are UTC instants | [i18n](architecture/i18n.md) |
| **Catalog** | The ICU message files in `packages/i18n/messages` (`en` is the source, `pt-BR` must match). A missing key fails CI | [i18n](architecture/i18n.md) |
| **ADR** | Architecture Decision Record. Immutable once accepted; superseded by a new one | [ADR index](architecture/adr/README.md) |

## Process

| Term | Meaning | Owner doc |
|---|---|---|
| **Owner** | The product owner (a human who speaks Brazilian Portuguese). Decides business rules, approves merges, supplies credentials and reviews screens | [AGENTS.md](../AGENTS.md) |
| **Milestone** | A GitHub milestone (M0 to M12+) with exit criteria in the roadmap | [roadmap](product/roadmap.md) |
| **agent-ready** | A label: the issue is fully specified and safe to pick up once its dependencies are merged | [git workflow](engineering/git-workflow.md#labels) |
| **needs:decision** | A label: a human decision is needed before the work can be finished | [git workflow](engineering/git-workflow.md#labels) |
| **Handoff** | The note a session leaves on the issue or PR so the next agent can continue | [handoff](agents/handoff.md) |
| **Current state** | The living summary of project progress, open work, blockers and owner-dependent items | [current state](agents/current-state.md) |
| **Throwaway database** | A `globetrot_test_*` database an integration test creates and drops by itself | [data model](architecture/data-model.md#testing-against-a-real-database) |
| **Stand-in API** | The small fake API that the account-screens browser check runs against | [authentication](architecture/authentication.md#tests) |
