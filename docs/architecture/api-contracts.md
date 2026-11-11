# API contracts

The HTTP API is a thin adapter over [`packages/application`](adr/0006-api-and-application-layer.md): routes validate nothing about the business and decide nothing about permissions. They build an `Actor`, call one operation and translate the result. This page describes what is implemented (#56 the foundation, #61 trips, #58 preferences, #57 the providers query) and how to add an operation. Decisions: [ADR-0006](adr/0006-api-and-application-layer.md), [ADR-0010](adr/0010-web-proxies-the-api.md), [ADR-0011](adr/0011-idempotency-audit-and-units-of-work.md).

```text
Browser ─► apps/web (proxy.ts: /api/auth/*, /v1/*) ─► apps/api ─► @globetrot/application ─► ports ─► @globetrot/db
                                                         │
                                                         └─► /v1/openapi.json ─► packages/api-client (generated types)
```

## Versioning

- Every operation lives under **`/v1`**. A breaking change gets `/v2` next to it, never a silent edit. Adding an optional field or a new operation is not breaking.
- The contract is the OpenAPI 3.1 document served (publicly) at `GET /v1/openapi.json` and committed as `packages/api-client/openapi.json`. The `info.version` is the version of that contract.
- `/api/auth/*` (Better Auth) is separate and is not part of the OpenAPI contract: [`authentication.md`](authentication.md).

## Who is calling: the `Actor`

- `app.use('/v1/*')` in `apps/api/src/app.ts` resolves the **session cookie** through Better Auth and sets `actor = { kind: 'user', userId }`. It is the only place an actor is created.
- **No request field can name the caller.** Not a header (`X-User-Id`, `Authorization`, …), not a query parameter, not a body field. Operations take no user id for "me". Tests try every one of these and check the answer does not change (`app.test.ts`, `v1.int.test.ts`).
- No session: `401`, before any operation or port is touched. `/v1/openapi.json` and `/v1/auth/providers` are the only public paths under `/v1`. They are registered **before** the authentication middleware, and Hono applies middleware in registration order, so anything registered after it requires a session.
- State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) from an untrusted `Origin` get `403 INVALID_ORIGIN`, as for auth ([`authentication.md`](authentication.md#request-protection)).
- The browser calls the web origin, never the API: `proxy.ts` forwards `/v1/*` (see `apps/web/lib/api-proxy.ts`), so the cookie is first-party. Server-side web code (pages, `i18n/request.ts`, server actions) calls the API directly through `API_INTERNAL_URL` and must forward the session cookie itself: `createServerApiClient` in `apps/web/lib/stored-preferences.ts` does, with a timeout, and nothing else of the browser's cookies.

## Errors: `application/problem+json`

Every error response, including 404 for an unknown route and 500, is RFC 9457 problem details:

```json
{
  "type": "urn:globetrot:problem:validation-failed",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "detail": "The input is not valid",
  "errors": [{ "field": "name", "code": "too_small", "message": "…" }]
}
```

| `code` | Status | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Known actor lacking a permission |
| `INVALID_ORIGIN` | 403 | Untrusted `Origin` on a state-changing request |
| `IDEMPOTENCY_KEY_REUSED` | 409 | An `Idempotency-Key` was already used with a different request |
| `NOT_FOUND` | 404 | Missing, **or not yours** (the two are indistinguishable on purpose) |
| `BAD_REQUEST` | 400 | The request body could not be read (malformed JSON) |
| `VALIDATION_FAILED` | 422 | Input broke the operation's schema. `errors` lists the fields |
| `INTERNAL_ERROR` | 500 | A bug. **No details**, no stack trace |

Clients switch on `code`, never on `detail` (which is English and may change). The 500 path logs only the kind of error (`unhandled TypeError (57P01) in a request`), because database driver errors can quote query parameters such as emails.

## Operations (`packages/application`)

An operation is `defineOperation({ name, kind, input, output, handler })`:

- `input` and `output` are Zod schemas. They are the contract: the same schema is the OpenAPI schema and, later, an MCP tool schema.
- `execute(actor, input)` validates the input (`ValidationError`), runs `handler(actor, input)` and returns the result **parsed through `output`**, so a field the schema does not name can never leak (a row with a hash or token comes out without it).
- Errors are `UnauthenticatedError`, `ForbiddenError`, `NotFoundError`, `ValidationError` (all `ApplicationError` with a stable `code`). Anything else is a bug and becomes a 500.
- **Ownership:** load the record, then `assertOwner(actor, record.ownerId)`. Another user's record is reported as not found.
- Storage goes through **ports** (`UserReader`, …) declared in `packages/application/src/ports.ts` and implemented in `apps/api/src/wire.ts`. The package has no HTTP, database or UI imports (lint-enforced), so unit tests use fakes.

Today:

| Operation | HTTP | Notes |
|---|---|---|
| `getCurrentUser` | `GET /v1/me` | `{ id, email, name, emailVerified }` of the caller and nothing else |
| `listAuthProviders` | `GET /v1/auth/providers` | **Public** (before sign-in). The social providers that are configured, so a screen never offers a button that cannot work. Empty until Google is set up (#55) |
| `getPreferences` | `GET /v1/me/preferences` | The caller's settings. A user who saved nothing gets `en`, `USD`, no country, nationality or time zone, `metric`, theme `system`, motion `full` |
| `updatePreferences` | `PATCH /v1/me/preferences` | Only the fields sent change, and none affects another. `null` clears `homeCountry`, `nationality` or `timeZone`; `locale`, `currency`, `units`, `theme` and `motion` cannot be cleared. At least one field. Audited (`preferences.update`, field names only) |
| `listTrips` | `GET /v1/trips[?includeArchived=true]` | The caller's trips, newest first, at most 200 (no pagination yet). Archived ones only on request |
| `createTrip` | `POST /v1/trips` | `201`. Private and active, USD unless a currency is given. Honours `Idempotency-Key` |
| `createTripFromExample` | `POST /v1/trips/from-example` | `201`. `exampleId` (`japan`, `portugal`, `rio-de-la-plata`) and an optional `title` in the person's language. Creates a private trip in USD with no dates and the example's route and nights (`application/src/examples/catalog.ts`). `Idempotency-Key` as for `createTrip`. Audited as `trip.create` with `fromExample` |
| `getTrip` | `GET /v1/trips/{id}` | |
| `updateTrip` | `PATCH /v1/trips/{id}` | Only the fields sent change; `startDate: null` clears the date; `status: "active"` restores an archived trip. At least one field |
| `listDestinations` | `GET /v1/trips/{id}/destinations` | The trip's route in order. A trip that is missing or someone else's is the same `404` |
| `replaceDestinations` | `PUT /v1/trips/{id}/destinations` | Replaces the whole route with the list sent (at most 100 stops; an empty list clears it). The server assigns ids and positions. Atomic and audited (`destination.replace`, the count only) |
| `getBudget` | `GET /v1/trips/{id}/budget` | Everything in the trip's currency: the total, by category and by status, and the savings plan from the domain rule (`status`, saved, monthly, left, progress, the month the goal is reached at the current monthly amount, what to put aside to be ready by departure, whether that is on time). Amounts are exact decimal strings with their currency |
| `listExpenses` | `GET /v1/trips/{id}/expenses` | The costs, newest first. Each shows what was typed, the amount in the trip's currency and, for another currency, the rate with its source and day |
| `createExpense` | `POST /v1/trips/{id}/expenses` | `201`. `amount` and `currency`, plus `fxRate` when the currency is not the trip's (required then, refused otherwise). The server converts and keeps the provenance. Audited (category and status only) |
| `updateExpense` | `PUT /v1/trips/{id}/expenses/{expenseId}` | Replaces the cost and reprices it. A cost of another trip is the same `404` |
| `deleteExpense` | `DELETE /v1/trips/{id}/expenses/{expenseId}` | Removes it |
| `updateSavings` | `PUT /v1/trips/{id}/savings` | `saved` and/or `monthly`, in the trip's currency, zero allowed. Answers with the new budget |
| `getChecklist` | `GET /v1/trips/{id}/checklist` | The items in the order they were added (`group`: documents, money, bookings, packing; `label`; `done`) and the nine readiness stamps as they stand now. Stamps are computed from what the trip has today (route, costs, savings, lists), never stored |
| `addChecklistItems` | `POST /v1/trips/{id}/checklist` | `201`. One to 30 `{ group, label }` at once (a single add or the suggested starter list). A trip keeps at most 100 items (`422`, `checklist_full`). Audited (groups and count only, never labels). Answers with the new lists |
| `updateChecklistItem` | `PATCH /v1/trips/{id}/checklist/{itemId}` | `done` and/or `label`; at least one. An item of another trip is the same `404` |
| `deleteChecklistItem` | `DELETE /v1/trips/{id}/checklist/{itemId}` | Removes it. Answers with the new lists |
| `archiveTrip` | `POST /v1/trips/{id}/archive` | Hides the trip from the default list. **There is no delete** (retention is specified separately), so there is deliberately no `DELETE`. Archiving twice is a no-op |

Trip rules: the title is trimmed and has 1 to 120 characters; `startDate` is a real calendar date or null; `currency` is an active ISO 4217 code (`VALIDATION_FAILED`, field `currency`, code `custom` when unknown); `status` is one of `active`, `traveling`, `completed`, `archived`. Status is set by the user and never derived. `visibility` is always `private` for now. The response never includes the owner. Field error codes are Zod's issue codes (`too_small`, `too_big`, `invalid_format`, `invalid_value`, `custom`).

Preference rules: `locale` is a supported language (`en`, `pt-BR`, exact case); `currency` an active ISO 4217 code; `homeCountry` and `nationality` an assigned ISO 3166-1 alpha-2 code in upper case; `timeZone` an IANA name (UTC offsets are refused); `units` `metric` or `imperial`; `theme` `day`, `red-eye` or `system`; `motion` `full` or `reduced`. Errors are `VALIDATION_FAILED` with the field name and a Zod code (`custom` for an unknown value, `invalid_format` for the wrong shape, `invalid_value` for a unit system, theme or motion setting, `invalid_type` when a field that cannot be cleared is `null`). There is no user id in the request: the actor is the only source of "whose".

### Idempotency (mutations)

- Send `Idempotency-Key: <8–128 characters of letters, digits and . _ : ->` (a UUID works) on `POST /v1/trips`. The key is scoped to the caller.
- **Same key, same request:** the original trip comes back (`201`, same body) and nothing new is created or audited. "Same request" compares the title, start date and currency after defaults (an omitted currency equals `USD`), not the raw text.
- **Same key, different request:** `409` with code `IDEMPOTENCY_KEY_REUSED`. Send a new key for a new request.
- Several identical requests at once are safe: only one does the work and the others get its result (the key is reserved by a unique row inside the transaction).
- If the request fails (validation, an error), the key is **not** consumed: nothing was committed, so the retry runs normally. Keys are kept in the `idempotency_key` table; a later cleanup job can drop old ones.
- Without a header, every call creates a new trip.

### Audit

Every mutation writes one `audit_event` in the same transaction: actor, action (`trip.create`, `trip.update`, `trip.archive`, `preferences.update`), entity and time. The metadata holds the **names** of the changed fields (and the new status, a fixed word), never titles, dates, countries, time zones or any user text. A replayed or no-op request writes nothing. Reads are not audited. The table is append-only ([`data-model.md`](data-model.md#trips-idempotency-and-audit)).

## Adding an operation

1. **Application:** add the operation under `packages/application/src/` (see `trips/` for a full example: schemas, operations, unit tests), with its schemas, authorization and any new port. A mutation runs inside `unitOfWork.run` and writes its audit event there; one that retries safely takes an idempotency key as in `createTrip`. Register it in `createApplication` (`src/index.ts`). Unit test it with the in-memory ports of `@globetrot/application/testing`, including a refusal for another user.
2. **Adapter:** if there is a new port, implement it in `packages/db/src/repositories.ts` (the SQL) and wire it in `apps/api/src/wire.ts`. Cover it with a `*.int.test.ts` against a real database.
3. **Route:** in `apps/api/src/routes/` (see `trips.ts`), registered from `app.ts`, `createRoute({ method, path: '/v1/…', operationId, security: [{ cookieAuth: [] }], request, responses })` and `app.openapi(route, handler)`. The handler only calls `application.<operation>.execute(c.get('actor'), input)`. Declare the problem+json responses.
4. **Contract:** run `pnpm api:generate` and commit `packages/api-client/openapi.json` and `src/generated/schema.ts`. Two tests fail while they are stale (`apps/api/src/openapi.test.ts`, `packages/api-client/src/contract.test.ts`), so CI catches a forgotten run. Never edit the generated files by hand.
5. **Integration test** (`*.int.test.ts`, real database): anonymous, owner and another user.

## The typed client (`packages/api-client`)

`createApiClient({ baseUrl })` wraps `openapi-fetch` with the generated `paths` type, so paths, parameters and responses are checked by the compiler (an unknown path does not compile). `data` is the success body and `error` is the problem+json body:

```ts
const { data, error } = await client.GET('/v1/me');
if (error) handle(error.code); // 'UNAUTHENTICATED'
else show(data.email);
```
