import { uuidV7Time } from '@globetrot/domain';
import { mediaKey } from '../media/operations';
import type { Clock, StoragePort } from '../ports';

/** How long an upload may wait to be placed on a post or a stop before it is removed. */
export const UNPLACED_MEDIA_HOURS = 24;
/** How long an idempotency record is kept (a retry window). */
export const IDEMPOTENCY_KEEP_DAYS = 7;
/** A stored object without a row is only removed when older than this, so an upload in progress is safe. */
export const STRAY_OBJECT_HOURS = 1;
const BATCH = 200;
const HOUR = 60 * 60 * 1000;

export interface MaintenanceStore {
  unplacedMedia(before: Date, limit: number): Promise<string[]>;
  deleteMedia(ids: readonly string[]): Promise<void>;
  existingMedia(ids: readonly string[]): Promise<Set<string>>;
  deleteIdempotencyKeysBefore(before: Date): Promise<number>;
}

export interface MaintenanceReport {
  readonly unplacedMedia: number;
  readonly strayObjects: number;
  readonly idempotencyKeys: number;
}

/**
 * Housekeeping that no person triggers (ADR-0017): uploads never placed, stored images whose row is gone (a
 * deletion that failed halfway), and old idempotency records. Every step is safe to repeat and to interrupt.
 */
export function createMaintenance(deps: {
  readonly store: MaintenanceStore;
  readonly storage: StoragePort;
  readonly clock: Clock;
}) {
  async function sweepUnplacedMedia(now: Date): Promise<number> {
    let removed = 0;
    for (;;) {
      const ids = await deps.store.unplacedMedia(
        new Date(now.getTime() - UNPLACED_MEDIA_HOURS * HOUR),
        BATCH,
      );
      if (ids.length === 0) return removed;
      // Rows first: once a row is gone nobody can open the image, and the bytes follow.
      await deps.store.deleteMedia(ids);
      await Promise.allSettled(ids.map((id) => deps.storage.delete(mediaKey(id))));
      removed += ids.length;
      if (ids.length < BATCH) return removed;
    }
  }

  async function sweepStrayObjects(now: Date): Promise<number> {
    let removed = 0;
    let after: string | undefined;
    do {
      const page = await deps.storage.list('media/', after);
      const ids = page.keys
        .map((key) => key.slice('media/'.length))
        .filter((id) => {
          const made = uuidV7Time(id);
          return made !== null && now.getTime() - made.getTime() > STRAY_OBJECT_HOURS * HOUR;
        });
      const existing = await deps.store.existingMedia(ids);
      const strays = ids.filter((id) => !existing.has(id));
      await Promise.allSettled(strays.map((id) => deps.storage.delete(mediaKey(id))));
      removed += strays.length;
      after = page.next ?? undefined;
    } while (after);
    return removed;
  }

  return {
    async run(): Promise<MaintenanceReport> {
      const now = deps.clock.now();
      const unplacedMedia = await sweepUnplacedMedia(now);
      const strayObjects = await sweepStrayObjects(now);
      const idempotencyKeys = await deps.store.deleteIdempotencyKeysBefore(
        new Date(now.getTime() - IDEMPOTENCY_KEEP_DAYS * 24 * HOUR),
      );
      return { unplacedMedia, strayObjects, idempotencyKeys };
    },
  };
}
