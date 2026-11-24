# 0017. The worker: hourly housekeeping behind an advisory lock

- Status: Accepted
- Date: 2026-11-13

## Context
Three earlier decisions left work for "a job runner, later": uploads that are never placed ([ADR-0014](0014-photos-and-storage.md)), stored images whose deletion failed after their rows went ([ADR-0015](0015-account-export-and-deletion.md)), and idempotency records that only matter for a retry window ([ADR-0011](0011-idempotency-audit-and-units-of-work.md)). `apps/worker` was a placeholder that mentioned pg-boss. None of this work needs a queue: it is periodic, idempotent and can be interrupted.

## Decision
- **`apps/worker` runs a simple scheduler**: a first round one minute after start, then every `MAINTENANCE_INTERVAL_MINUTES` (default 60); never two rounds at once; on SIGTERM it waits for the round in progress. A failed round is logged by kind only and the next one runs.
- **One round across all instances**: each round takes a Postgres session advisory lock (`pg_try_advisory_lock`) on a dedicated connection and skips when another instance holds it.
- **The round** (`createMaintenance` in the application, queries in `createMaintenanceRepository`):
  1. uploads older than **24 hours** that no post (including a deleted, restorable one) and no stop shows: rows first, then their stored bytes;
  2. stored images under `media/` whose row is gone and whose id (UUIDv7) is older than **1 hour**, so an upload in progress is never touched;
  3. idempotency records older than **7 days**.
  Logs carry counts only.
- **Trial emails** run in the same round since [ADR-0019](0019-plans-trial-and-pip-credits.md): the worker reads the `SMTP_*` settings and `BETTER_AUTH_URL` too, through `@globetrot/mailer` (the SMTP adapter, moved out of the API).
- **The S3 adapter moves to `@globetrot/storage`**, shared by the API and the worker, with `list` added (ListObjectsV2). Its settings reader (`storageConfigFromEnv`) holds the production rules in one place.
- **pg-boss is not added** until there is real queued work (emails in bulk, imports, notifications).

## Consequences
- The worker needs `DATABASE_URL` and the `S3_*` settings in production, like the API.
- The bundled worker gets a `require` shim so bundled CommonJS dependencies (pg) can load Node built-ins.
- Retention numbers (24 h, 1 h, 7 days) are constants in the application, documented in the data model.
