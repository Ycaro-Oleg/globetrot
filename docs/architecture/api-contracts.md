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
| `PLAN_REQUIRED` | 402 | The trial is over and there is no plan: the account is read-only ([ADR-0019](adr/0019-plans-trial-and-pip-credits.md)) |
| `TRIP_LIMIT_REACHED` | 402 | The plan's active trips are all used |
| `OUT_OF_CREDITS` | 402 | Pip credits for the period, and bought ones, are spent |
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
| `getBilling` | `GET /v1/me/billing` | The trial or plan (`access`: `trial`, `explorer`, `voyager`, `free`), `overLimit` (more counted trips than the plan keeps), `priceCurrency` (`USD` or `BRL`), `passes` (`tripId`, `validUntil`), trial end and days left, renewal, active and counted trips and the limit, and Pip credits (`monthly`, `monthlyLeft`, `topUpLeft`, `total`, `periodEnd`, `dailyCap`) ([ADR-0019](adr/0019-plans-trial-and-pip-credits.md), [ADR-0023](adr/0023-free-plan-trip-pass-and-prices-in-reais.md)) |
| `startCheckout` | `POST /v1/me/billing/checkout` | `item` (`explorer`, `voyager`, `top-up`, `trip-pass`), `interval` (`month`, `year`), `tripId` (for a pass). The payment provider's checkout URL, in the person's price currency. Open over the trip limit. `404` for a pass on a trip that is not theirs, `503` while payments are off |
| `getTripMembers` | `GET /v1/trips/{id}/members` | Owner first, then members (`userId`, `name`, `role`, `you`); the owner also sees open `invites` and `guestLimit`. Anyone on the trip may read it ([ADR-0024](adr/0024-trip-members.md)) |
| `createInvite` | `POST /v1/trips/{id}/invites` | Owner only. Optional `role` (`editor` by default). `201` with the `token` (shown once) and `expiresAt`. `402 GUEST_LIMIT_REACHED` when the plan allows no more people |
| `revokeInvite` | `DELETE /v1/trips/{id}/invites/{inviteId}` | Owner only. Stops an open link |
| `removeMember` | `DELETE /v1/trips/{id}/members/{userId}` | Owner only |
| `leaveTrip` | `POST /v1/trips/{id}/leave` | A member leaves; `404` for the owner |
| `previewInvite` | `GET /v1/invites/{token}` | Signed in. The trip's title, the owner's name, the role and whether the caller already plans it. Revoked, expired, unknown links and archived trips are `404` |
| `acceptInvite` | `POST /v1/invites/{token}` | Joins; accepting twice or as the owner changes nothing. Returns the trip with the caller's `role` |
| `getGroupMoney` | `GET /v1/trips/{id}/money` | Each person's part (`share`, `shareBp`), `saved`, `monthly`, `left`, `readyMonth`; the group's `total`, `saved`, `left`; the settling (`transfers` with names, `paid`, `unassigned`). Anyone on the trip ([ADR-0025](adr/0025-money-between-members.md)) |
| `updateMyMoney` | `PUT /v1/trips/{id}/money/me` | The caller's own `saved` and `monthly` for their part. Anyone on the trip, viewers too |
| `setShares` | `PUT /v1/trips/{id}/shares` | Owner only. Everyone's `shareBp` adding up to 10 000, or `shares: null` to split equally |
| `getHabit` | `GET /v1/trips/{id}/habit` | The ISO `week` in the caller's time zone, `checkedIn` (or null), `streak`, `suggested` and the `countdown` (`daysLeft`, `phase`, `tasks`) ([ADR-0026](adr/0026-saving-habit-and-countdown.md)) |
| `checkIn` | `POST /v1/trips/{id}/checkin` | `amount` set aside this week; adds to the caller's savings, replacing this week's earlier check-in. Anyone on the trip |
| `getSavingsHistory` | `GET /v1/trips/{id}/savings/history` | Everyone's weekly check-ins added up per week (oldest first, at most two years) with the running total; `start` is the savings typed in rather than checked in, `saved` what is set aside now. Feeds the money charts. Another person's trip is 404 |
| `getMiles` | `GET /v1/trips/{id}/miles` | The caller's `programs` (balance, miles on this trip, typical value in reais), `researchedOn`, `sources`, the `applied` value in the trip's currency and the answer `withMiles` (`left`, `readyMonth`) ([ADR-0030](adr/0030-miles-in-the-savings.md)) |
| `setMiles` | `PUT /v1/me/miles/{program}` | `balance`; zero removes it and what went towards trips |
| `setTripMiles` | `PUT /v1/trips/{id}/miles/{program}` | `miles` towards the trip; never more than the balance (`422`) |
| `openBillingPortal` | `POST /v1/me/billing/portal` | The provider's page to change the card, switch or cancel. `404` before the first payment, `503` while payments are off |
| `getReferral` | `POST /v1/me/referral` | The caller's `code` (made the first time), how many friends `joined` and `passCredits` left ([ADR-0029](adr/0029-referrals.md)) |
| `claimReferral` | `POST /v1/me/referral/claim` | `code`; within 7 days of signing up, never one's own, once. `claimed: false` otherwise |
| `redeemPassCredit` | `POST /v1/trips/{id}/pass/redeem` | Uses a free pass on one of the caller's trips; `404` without one |
| `getAdminMetrics` | `GET /v1/admin/metrics` | Counts only (accounts, trips by source, saving, check-ins per week, retention, sharing, paying). Verified accounts in `ADMIN_EMAILS`; everyone else `404` ([ADR-0031](adr/0031-partner-links-and-metrics.md)) |
| `getInboundAddress` | `POST /v1/me/inbound` | The caller's forwarding `address` (made the first time), or null while forwarding is off ([ADR-0032](adr/0032-bookings-by-email.md)) |
| (webhook) | `POST /v1/inbound/email` | No session; the `x-inbound-secret` header must match. Postmark-compatible body. Answers `{ outcome }`: `proposed`, `unknown-address`, `no-trip`, `not-answered`. `404` while off |
| `getTripShare` / `shareTrip` / `unshareTrip` | `GET`/`PUT`/`DELETE /v1/trips/{id}/share` | The trip's public link: `{ slug, showAmounts }`. `PUT` keeps the address when it is on and sets `showAmounts`; `DELETE` ends it for good and works when the account is read-only ([business rules](../product/business-rules.md#sharing-a-trip)) |
| `getSharedTrip` | `GET /v1/shared/{slug}` | **No session.** Title, the owner's interface language (`locale`, for the social card), start month, nights, stops (name, country, nights, coordinates), the savings status, progress and ready month, and amounts only when shared. Unknown, malformed, stopped or archived all answer `404` |
| (webhook) | `POST /v1/webhooks/stripe` | Stripe's events, trusted only by the `Stripe-Signature` over the raw body (no session). `400` for a bad or old signature, `500` so Stripe retries, `200` otherwise, `404` while Stripe is off. Not in the OpenAPI contract: no client calls it ([stripe](../integrations/stripe.md#how-it-is-built)) |
| `updatePreferences` | `PATCH /v1/me/preferences` | Only the fields sent change, and none affects another. `null` clears `homeCountry`, `nationality` or `timeZone`; `homePoint` (`{ latitude, longitude }` of the home city, or `null`) is cleared when `homeCity` changes without it; `locale`, `currency`, `units`, `theme` and `motion` cannot be cleared. At least one field. Audited (`preferences.update`, field names only). Also `homeCity` (1 to 120 characters, `null` clears it) `pipOptIn` (boolean), `pipLook` (`{hat, outfit, bag, bagColor}`, each from its closed list, all four together) and `pipName` (1 to 16 characters after trimming, `null` brings back "Pip") |
| `listTrips` | `GET /v1/trips[?includeArchived=true]` | The caller's trips, newest first, then the trips shared with them, at most 200 each (no pagination yet). Each has `role` (`owner`, `editor`, `viewer`). Archived ones only on request |
| `createTrip` | `POST /v1/trips` | `201`. Private and active, USD unless a currency is given. Honours `Idempotency-Key` |
| `createTripFromSuggestion` | `POST /v1/trips/from-suggestion` | `201`. A suggested plan (`destination`, `likes`, `days`, `comfort`, ADR-0020), the trip's `currency` (one the plans can show), an optional `monthly`, `title`, `estimateLabel` and `locale`. Creates the trip with the plan's stops, nights, legs and places, its estimate as the guess (at the recorded reference rate when the trip is not in USD) and the monthly savings. `Idempotency-Key` as for `createTrip`. `402` at the plan's trip limit, `422` for an unknown destination. |
| `createTripFromExample` | `POST /v1/trips/from-example` | `201`. `exampleId` (`japan`, `portugal`, `rio-de-la-plata`) an optional `title` in the person's language and an optional `locale` (`en`, `pt-BR`) for the stops' names (Lisboa, Tóquio, Quioto…). Creates a private trip in USD with no dates and the example's route and nights (`application/src/examples/catalog.ts`). `Idempotency-Key` as for `createTrip`. Audited as `trip.create` with `fromExample` |
| `getTrip` | `GET /v1/trips/{id}` | The owner's or a member's trip, with the caller's `role` |
| `updateTrip` | `PATCH /v1/trips/{id}` | Only the fields sent change; `startDate: null` clears the date; `status: "active"` restores an archived trip. At least one field |
| `listDestinations` | `GET /v1/trips/{id}/destinations` | The trip's route in order. A trip that is missing or someone else's is the same `404` |
| `replaceDestinations` | `PUT /v1/trips/{id}/destinations` | Replaces the whole route with the list sent (at most 100 stops; an empty list clears it). The server assigns positions and ids; a stop keeps its id across saves (matched by `placeKey`). Atomic and audited (`destination.replace`, the count only). Each stop may carry `note` and `legMode` (the leg to the next stop; dropped on the last one), `visited`, `spotRoute` (draw the route between its placed spots, A, B, C… in their order; default `false`), and its own `spots` (`{ name, kind?, latitude?, longitude?, done }`, at most 30; `kind` is `stay`, `food`, `sight`, `shop`, `transport` or `other`, defaults to `sight`, and is always present in the answer), `todos` (`{ text, done }`, at most 30) and `photos` (`{ mediaId, alt }` of the caller's uploads, at most 12). The answer adds `stampedVisas`: the commemorative visas this change stamped (the first visited stop per country, once per person), audited as `visa.stamp` with the count only |
| `listVisas` | `GET /v1/visas` | The caller's commemorative visas (`countryCode`, `city`, `stampedAt`), newest first. Decorative, never an official document |
| `askPip` | `POST /v1/trips/{id}/pip/proposals` | `request` (1–500), and optionally `spotCandidates` (`{ placeKey, places: [{ name, kind, latitude, longitude }] }`, at most 40): "fill this pin", Pip may then only answer `addSpot` changes for that stop, each one of those places (the model names a candidate; the server fills in the name, place and kind; places over 40 km from the stop are ignored; an unknown `placeKey` answers `404`). Sends the trip's plan to the AI provider and answers a stored proposal (`summary`, `changes`, `currency`, `status: proposed`). `402 OUT_OF_CREDITS` when the period's and bought credits are spent, `429` after 40 a day, `503` when Pip is not configured or the model did not answer ([ADR-0016](adr/0016-pip-on-deepseek.md)) |
| `listProposals` | `GET /v1/trips/{id}/pip/proposals` | The trip's last ten proposals, newest first, each with `undoable` |
| `applyProposal` / `discardProposal` / `undoProposal` | `POST /v1/pip/proposals/{proposalId}/apply` (`include`: indexes), `…/discard`, `…/undo` | Apply in one transaction; undo within 24 hours. `422 already_decided` / `not_undoable`; another person's proposal is `404` |
| `uploadMedia` | `POST /v1/media` | The raw bytes of a JPEG, PNG or WebP as the body (8 MB, 8192 px). The type is read from the bytes; metadata is removed before storing. Answers `{ id, contentType, width, height }`. `413` over 8 MB, `422 unsupported_image`, `429` after 100 a day |
| `getMedia` | `GET /v1/media/{mediaId}` | The bytes, for the owner or for someone who may see a post that shows it; otherwise `404`. `Cache-Control: private` |
| `listFeed` | `GET /v1/community/feed?feed=&before=&limit=` | `all` (everything the caller may see) or `following` (people they follow and themselves), newest first, 20 by default, `nextBefore` for the next page. Applies the visibility rule (business rules, "Community") |
| `getPost` / `updatePost` / `deletePost` / `restorePost` | `GET`, `PATCH`, `DELETE /v1/community/posts/{postId}`, `POST …/restore` | One post; edit the words or delete (soft) and restore one's own. Anything the caller may not see, or not theirs to change, is `404` |
| `createPost` | `POST /v1/community/posts` | `kind`, `body`, `place?`, `audience`, `photos?` (moments and tips: up to 4 `{ mediaId, alt }` of the caller's uploads), plus `tripId` (route, goal), `showAmounts` (route) or `visaCountry` (visa); the snapshot is made on the server from the caller's own data. `Idempotency-Key` supported. `429` after 30 posts a day |
| `addLike` / `removeLike`, `addSave` / `removeSave` | `PUT`/`DELETE /v1/community/posts/{postId}/like`, `/save` | Answer the post as the caller now sees it |
| `listComments` / `addComment` | `GET`/`POST /v1/community/posts/{postId}/comments` | Oldest first, without deleted ones or muted people's. `429` after 200 comments a day |
| `deleteComment` / `restoreComment`, `addCommentLike` / `removeCommentLike` | `DELETE /v1/community/comments/{commentId}`, `POST …/restore`, `PUT`/`DELETE …/like` | Remove: the comment's or the post's author |
| `reportPost` | `POST /v1/community/posts/{postId}/report` | `reason`: `spam`, `abuse`, `unsafe`, `other`. Once per person; three distinct reports hide the post |
| `copyRoute` | `POST /v1/community/posts/{postId}/copy-route` | A new private USD trip from a route post, or the caller's existing copy (not archived) when they already made one. `Idempotency-Key` supported. Posts show `copiedTripId`: the caller's copy, or null |
| `getPerson` / `listPersonPosts` | `GET /v1/community/people/{handle}`, `…/posts` | The person's name, handle, Pip and counts, and their posts the caller may see |
| `followPerson` / `unfollowPerson`, `mutePerson` / `unmutePerson` | `PUT`/`DELETE /v1/community/people/{handle}/follow`, `/mute` | Never oneself (`422`) |
| `getCommunityMe` / `updateHandle` | `GET`/`PATCH /v1/community/me` | The caller's handle (null until they first act) and counts; change the handle (`422 handle_taken`) |
| `getDiscover` | `GET /v1/community/discover` | Who to follow and trending countries, from public posts of the last 30 days |
| `searchPlaces` | `GET /v1/places/search?query=&language=` | Up to 8 places from the `GeocodingPort` (Geoapify), each with a stable `key`, coordinates and `attribution`. The provider key stays on the server. `429` after 60 lookups a minute per person (shared with reverse), When the provider is not configured or not answering, it answers from the built-in city index (`gn:` keys, attribution `GeoNames`), then the built-in popular cities (`gt:` keys), and `503` only when nothing there matches. Queries are not logged or audited |
| `searchCities` | `GET /v1/places/cities?query=&language=` | Up to 8 cities from the built-in index (GeoNames cities of 15 000 people or more, CC BY 4.0): no provider, instant. Accents and case ignored; bigger cities first; a name in another language counts only when typed in full ("Londres"); Portuguese names for popular cities in `pt-BR`. Same 60-a-minute limit as the other lookups. Not logged |
| `reversePlace` | `GET /v1/places/reverse?latitude=&longitude=&language=` | The place at a point (`place` null at sea). Same limit and `503` |
| `getBudget` | `GET /v1/trips/{id}/budget` | Everything in the trip's currency: the total, by category and by status, and the savings plan from the domain rule (`status`, saved, monthly, left, progress, the month the goal is reached at the current monthly amount, what to put aside to be ready by departure, whether that is on time), plus the trip `ceiling` and `ceilingSlack` (ceiling − total, negative when over), both null without a ceiling, and `guess` (the rough guess and what it still `counted` for in the total, or null). Amounts are exact decimal strings with their currency |
| `listExpenses` | `GET /v1/trips/{id}/expenses` | The costs, newest first. Each shows what was typed, the amount in the trip's currency and, for another currency, the rate with its source and day |
| `createExpense` | `POST /v1/trips/{id}/expenses` | `201`. `amount` and `currency`, plus `fxRate` when the currency is not the trip's (required then, refused otherwise). The server converts and keeps the provenance. `guess: true` marks the trip's rough guess (the onboarding sends it; a second one is `422`). Every cost shows `guess`. Audited (category and status only) |
| `updateExpense` | `PUT /v1/trips/{id}/expenses/{expenseId}` | Replaces the cost and reprices it. A cost of another trip is the same `404` |
| `deleteExpense` | `DELETE /v1/trips/{id}/expenses/{expenseId}` | Removes it |
| `updateSavings` | `PUT /v1/trips/{id}/savings` | `saved`, `monthly` and/or `ceiling`, in the trip's currency, zero allowed; `ceiling: null` clears the ceiling. Fields left out keep their value. Answers with the new budget. Audited (field names only) |
| `listDayPlaces` | `GET /v1/trips/{id}/day-places` | The trip's places to see in trip order: `name`, `minutes`, `destinationId` (null when none or removed), `day` (null for "No day", also when the route no longer reaches it) |
| `suggestDayPlaces` | `GET /v1/trips/{id}/day-ideas?language=` | Up to 6 ideas (`name`, `kind`, `minutes`) for each of the first 6 stops, without places already planned; `source` is `provider` (with `attribution`) or `built-in`, null when there is nothing. `429` after 20 a minute ([business rules](../product/business-rules.md#trips)) |
| `addDayPlace` | `POST /v1/trips/{id}/day-places` | `201`. `name`, `minutes` (15–720), optional `destinationId` (a stop of the trip). Saved to "No day". At most 200 per trip. Audited without the name |
| `moveDayPlace` | `PATCH /v1/trips/{id}/day-places/{placeId}` | `day` (a day of the route, or null) and optional `beforeId` (a place on that day); without it, the end of the day. `422` for a day the route does not have |
| `removeDayPlace` | `DELETE /v1/trips/{id}/day-places/{placeId}` | Answers with the plan. Another person's place is the same `404` |
| `getChecklist` | `GET /v1/trips/{id}/checklist` | The items in the order they were added (`group`: documents, money, bookings, packing; `label`; `done`) and the nine readiness stamps as they stand now, computed from what the trip has today (route, costs, savings, lists). `firstTime` is always empty here: the changes below fill it with the stamps they earned for the very first time (recorded then, never announced twice) |
| `addChecklistItems` | `POST /v1/trips/{id}/checklist` | `201`. One to 30 `{ group, label }` at once (a single add or the suggested starter list). A trip keeps at most 100 items (`422`, `checklist_full`). Audited (groups and count only, never labels). Answers with the new lists |
| `updateChecklistItem` | `PATCH /v1/trips/{id}/checklist/{itemId}` | `done` and/or `label`; at least one. An item of another trip is the same `404` |
| `deleteChecklistItem` | `DELETE /v1/trips/{id}/checklist/{itemId}` | Removes it. Answers with the new lists |
| `archiveTrip` | `POST /v1/trips/{id}/archive` | Hides the trip from the default list. Archiving twice is a no-op |
| `deleteTrip` | `DELETE /v1/trips/{id}` | Deletes an **archived** trip and everything in it (`422 not_archived` otherwise). Audited (`trip.delete`) |
| `exportAccount` | `GET /v1/me/export` | The account's data as one JSON attachment (`format`, `version`, `exportedAt`, `data`); never password hashes or tokens ([ADR-0015](adr/0015-account-export-and-deletion.md)) |
| `deleteAccount` | `DELETE /v1/me` | `confirmEmail` must match the account's email (`422 confirmation_mismatch`). Deletes the account and everything it owns, including stored images; the audit log keeps its rows. Audited (`account.delete`, a count only) |

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
