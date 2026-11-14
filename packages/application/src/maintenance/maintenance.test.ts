import { uuidV7 } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import type { StoragePort } from '../ports';
import { createMaintenance, type MaintenanceStore } from './maintenance';

const NOW = new Date('2026-11-13T12:00:00Z');
const HOUR = 3600_000;
const idAt = (msAgo: number) =>
  uuidV7(NOW.getTime() - msAgo, crypto.getRandomValues(new Uint8Array(10)));

function setup(rows: { id: string; createdAt: Date; placed: boolean }[], objects: string[]) {
  const stored = new Set(objects.map((id) => `media/${id}`));
  const media = new Map(rows.map((row) => [row.id, row]));
  let keys = 3;
  const store: MaintenanceStore = {
    async unplacedMedia(before, limit) {
      return [...media.values()]
        .filter((row) => row.createdAt < before && !row.placed)
        .slice(0, limit)
        .map((row) => row.id);
    },
    async deleteMedia(ids) {
      for (const id of ids) media.delete(id);
    },
    async existingMedia(ids) {
      return new Set(ids.filter((id) => media.has(id)));
    },
    async deleteIdempotencyKeysBefore() {
      const removed = keys;
      keys = 0;
      return removed;
    },
  };
  const storage: StoragePort = {
    async put() {},
    async get() {
      return null;
    },
    async delete(key) {
      stored.delete(key);
    },
    async list(prefix) {
      return { keys: [...stored].filter((key) => key.startsWith(prefix)), next: null };
    },
  };
  const maintenance = createMaintenance({ store, storage, clock: { now: () => NOW } });
  return { maintenance, media, stored };
}

describe('maintenance', () => {
  it('removes uploads never placed after a day, keeping placed and recent ones', async () => {
    const old = idAt(30 * HOUR);
    const placed = idAt(30 * HOUR);
    const fresh = idAt(HOUR);
    const { maintenance, media, stored } = setup(
      [
        { id: old, createdAt: new Date(NOW.getTime() - 30 * HOUR), placed: false },
        { id: placed, createdAt: new Date(NOW.getTime() - 30 * HOUR), placed: true },
        { id: fresh, createdAt: new Date(NOW.getTime() - HOUR), placed: false },
      ],
      [old, placed, fresh],
    );
    const report = await maintenance.run();
    expect(report.unplacedMedia).toBe(1);
    expect([...media.keys()].sort()).toEqual([placed, fresh].sort());
    expect(stored.has(`media/${old}`)).toBe(false);
    expect(stored.has(`media/${placed}`)).toBe(true);
  });

  it('removes stored images without a row, but not one still being uploaded', async () => {
    const stray = idAt(5 * HOUR);
    const uploading = idAt(60_000);
    const { maintenance, stored } = setup([], [stray, uploading, 'not-a-uuid']);
    const report = await maintenance.run();
    expect(report.strayObjects).toBe(1);
    expect([...stored].sort()).toEqual([`media/${uploading}`, 'media/not-a-uuid'].sort());
  });

  it('clears old idempotency records and is safe to run again', async () => {
    const { maintenance } = setup([], []);
    expect((await maintenance.run()).idempotencyKeys).toBe(3);
    expect(await maintenance.run()).toEqual({
      unplacedMedia: 0,
      strayObjects: 0,
      idempotencyKeys: 0,
    });
  });
});
