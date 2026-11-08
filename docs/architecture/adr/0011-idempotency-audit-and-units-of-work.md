# 0011. Mutations are one transaction with their audit event and idempotency record

- Status: Accepted
- Date: 2026-11-08 (decided while building #56 and #61, recorded here)

## Context
[ADR-0006](0006-api-and-application-layer.md) says commands have idempotency keys and audit hooks. #61 (trips) is the first real mutation, so the convention had to become concrete. Retries from flaky networks, double clicks and (later) AI or MCP clients must not create duplicates, and every change must leave a trace without storing personal data.

## Decision
- **Unit of work.** A command runs inside `UnitOfWork.run(tx => …)`. The change, its audit event and its idempotency record commit or roll back together. Ports: `TripWriter`, `AuditLog`, `IdempotencyStore`; the SQL is in `packages/db/src/repositories.ts`; tests use in-memory fakes that also roll back (`@globetrot/application/testing`).
- **Idempotency.** `POST /v1/trips` honours `Idempotency-Key` (8 to 128 characters of `A-Za-z0-9._:-`). The key is scoped to the caller. The request's canonical form (defaults resolved, keys sorted) is the fingerprint. Same key and fingerprint returns the stored response and does nothing else; a different fingerprint is `409 IDEMPOTENCY_KEY_REUSED`. The key is reserved with a unique `(owner_id, key)` row inside the transaction, so concurrent duplicates serialize and only one does the work. A failed request does not consume the key.
- **Audit.** One append-only `audit_event` row per mutation: actor kind and id, `<entity>.<verb>`, entity type and id, and `metadata` with the **names** of changed fields (and fixed-word enums such as a new status), never values. A database trigger rejects `UPDATE`, `DELETE` and `TRUNCATE`. `actor_id` has no foreign key, so history survives the account. Replays and no-ops write nothing.
- **Ids.** Domain tables use UUIDv7 made by the application (`uuidV7` in `@globetrot/domain`, a pure function; the adapter supplies the clock and random bytes), so ids are time-sortable and known before the insert.
- **Ownership.** A record of another user is reported as **not found**, identically to a missing one (`assertOwner`), so existence does not leak.

## Alternatives considered
- **Idempotency in HTTP middleware:** it cannot be atomic with the change, and MCP and jobs would not get it.
- **Application-level locking or `SELECT … FOR UPDATE` on the key:** a unique row does the same job with less code.
- **Logging for audit:** not queryable, not guaranteed, not transactional.
- **Storing before/after values in the audit log:** useful for support, but it copies personal data (titles, countries, time zones) into a table that cannot be edited. Revisit with a retention policy.

## Consequences
Every new command repeats one pattern (`trips/operations.ts` is the model, and [`api-contracts.md`](../api-contracts.md#adding-an-operation) lists the steps). Idempotency rows accumulate until a cleanup job exists (they only matter for a retry window). Audit rows are permanent: account and data deletion (LGPD/GDPR) must be designed around that before it is built.
