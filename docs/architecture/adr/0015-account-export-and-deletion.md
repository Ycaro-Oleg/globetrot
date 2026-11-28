# 0015. Account export and deletion, and deleting archived trips

- Status: Accepted
- Date: 2026-11-13

## Context
LGPD and GDPR require that people can get a copy of their data and delete their account; the business rules listed both as required before a public release, but the design was open. Two constraints shaped it: `audit_event` is append-only by trigger ([ADR-0011](0011-idempotency-audit-and-units-of-work.md)), and `trip.owner_id` is `ON DELETE RESTRICT` so an account cannot vanish by accident with its trips.

## Decision
- **Export** (`GET /v1/me/export`, a download from Settings → "Your data"): one JSON document (`format: globetrot-account-export`, `version: 1`) with the account (name, email, sign-in methods by provider), preferences, every trip with its stops, costs, savings, lists and day plan, visas, the community profile, posts, comments, likes, saves, follows, mutes and reports, the list of uploads (each image downloadable at `GET /v1/media/{id}`) and the person's own audit history. Columns are named one by one in the adapter: password hashes, OAuth tokens and session tokens are never selected. Other people appear only by handle (follows, mutes).
- **Deletion** (`DELETE /v1/me`): the person types their email again. In one transaction the account's trips are deleted explicitly (the `RESTRICT` stays as a guard against accidents elsewhere), then the user row, which cascades to sessions, sign-in methods, preferences, visas, uploads and everything in the community, including their comments on other people's posts. After the commit the stored image bytes are deleted. An `account.delete` audit event is written with a count only.
- **The audit log is kept.** Its rows hold field names and enumerations, never personal values, and `actor_id` has no foreign key; after deletion it names an id that belongs to nobody. This is the retention position until legal advice says otherwise (listed for the owner).
- **Deleting a trip** (`DELETE /v1/trips/{id}`) is allowed only for an **archived** trip, after a confirmation step, so a single click never destroys a plan. Community posts that shared the route keep their snapshot ([ADR-0013](0013-community.md)).

## Alternatives considered
- **Soft-deleting accounts:** reversible, but keeps personal data around, which is what deletion is for.
- **Re-asking for the password before deleting:** stronger against a stolen session, but Google accounts have no password; the email confirmation applies to everyone. A fresh-session check can be added later.
- **Better Auth's own `deleteUser`:** would skip the application layer, its audit event and the storage cleanup.

## Consequences
- The web signs the person out (the session rows are gone and the cookie is cleared) and shows a confirmation on the log-in page.
- If deleting stored bytes fails, the object is unreachable (no row points to it); the worker sweeps such objects ([ADR-0017](0017-worker-housekeeping.md)).
- The export is assembled in one request; it is bounded by the existing per-trip and per-person limits, and history is capped at 10 000 events.
- **Billing** (added with #201, a consequence of plans existing since ADR-0019, not a change of this decision): a subscription that still renews is canceled at the payment provider, at once and with no refund, **before** anything is deleted; if the provider does not confirm, the deletion stops and can be repeated. Without it, a deleted account could keep being charged with nobody able to sign in and stop it. Details: [`stripe.md`](../../integrations/stripe.md#how-it-is-built).
