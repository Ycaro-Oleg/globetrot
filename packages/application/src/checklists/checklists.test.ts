import { describe, expect, it } from 'vitest';
import {
  createApplication,
  NotFoundError,
  ValidationError,
  type Actor,
  type UserRecord,
} from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'b@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const as = (user: UserRecord): Actor => ({ kind: 'user', userId: user.id });

async function setup() {
  const fake = createFakePorts({ users: [ana, bruno], now: new Date('2026-11-07T12:00:00.000Z') });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), { title: 'Japan 2027', startDate: null });
  return { ...fake, app, trip };
}

describe('checklists', () => {
  it('starts empty, keeps items in the order they were added and toggles them', async () => {
    const { app, trip } = await setup();
    const empty = await app.getChecklist.execute(as(ana), { tripId: trip.id });
    expect(empty.items).toEqual([]);
    expect(empty.readiness).toMatchObject({ docs: false, check: false, ready: false });

    const added = await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: [
        { group: 'documents', label: 'Passport' },
        { group: 'packing', label: 'Charger' },
      ],
    });
    expect(added.items.map((item) => item.label)).toEqual(['Passport', 'Charger']);
    expect(added.items.every((item) => !item.done)).toBe(true);

    const first = added.items[0]!;
    const done = await app.updateChecklistItem.execute(as(ana), {
      tripId: trip.id,
      itemId: first.id,
      done: true,
    });
    expect(done.items[0]).toMatchObject({ label: 'Passport', done: true });
    // every document is done, but not every item: only `docs` is earned
    expect(done.readiness).toMatchObject({ docs: true, check: false });
  });

  it('says a stamp is new only the first time the trip earns it', async () => {
    const { app, trip } = await setup();
    const added = await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: [{ group: 'documents', label: 'Passport' }],
    });
    expect(added.firstTime).toEqual([]);
    const item = added.items[0]!;
    const toggle = (done: boolean) =>
      app.updateChecklistItem.execute(as(ana), { tripId: trip.id, itemId: item.id, done });

    const earned = await toggle(true);
    expect(earned.firstTime).toEqual(expect.arrayContaining(['docs', 'check']));
    expect((await toggle(false)).firstTime).toEqual([]);
    const again = await toggle(true);
    expect(again.readiness).toMatchObject({ docs: true, check: true });
    expect(again.firstTime).toEqual([]);
    // Reading never records or announces anything.
    expect((await app.getChecklist.execute(as(ana), { tripId: trip.id })).firstTime).toEqual([]);
  });

  it('earns "all done" when every item is checked, and loses it when one is added', async () => {
    const { app, trip } = await setup();
    const added = await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: [{ group: 'money', label: 'Tell the bank' }],
    });
    const checked = await app.updateChecklistItem.execute(as(ana), {
      tripId: trip.id,
      itemId: added.items[0]!.id,
      done: true,
    });
    expect(checked.readiness.check).toBe(true);
    const more = await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: [{ group: 'packing', label: 'Umbrella' }],
    });
    expect(more.readiness.check).toBe(false);
  });

  it('renames and removes an item', async () => {
    const { app, trip } = await setup();
    const added = await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: [{ group: 'bookings', label: '  Hotel  ' }],
    });
    expect(added.items[0]?.label).toBe('Hotel');
    const renamed = await app.updateChecklistItem.execute(as(ana), {
      tripId: trip.id,
      itemId: added.items[0]!.id,
      label: 'Hotel in Kyoto',
    });
    expect(renamed.items[0]?.label).toBe('Hotel in Kyoto');
    const removed = await app.deleteChecklistItem.execute(as(ana), {
      tripId: trip.id,
      itemId: added.items[0]!.id,
    });
    expect(removed.items).toEqual([]);
  });

  it('refuses an empty change, a blank label and a list that is too long', async () => {
    const { app, trip } = await setup();
    const added = await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: [{ group: 'documents', label: 'Visa' }],
    });
    await expect(
      app.updateChecklistItem.execute(as(ana), { tripId: trip.id, itemId: added.items[0]!.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      app.addChecklistItems.execute(as(ana), {
        tripId: trip.id,
        items: [{ group: 'documents', label: '   ' }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    for (let batch = 0; batch < 3; batch++) {
      await app.addChecklistItems.execute(as(ana), {
        tripId: trip.id,
        items: Array.from({ length: 30 }, (_, i) => ({
          group: 'packing' as const,
          label: `Item ${batch}-${i}`,
        })),
      });
    }
    // 1 + 90 so far; 10 more reach the limit, one more is refused
    await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: Array.from({ length: 9 }, (_, i) => ({ group: 'packing' as const, label: `x${i}` })),
    });
    await expect(
      app.addChecklistItems.execute(as(ana), {
        tripId: trip.id,
        items: [{ group: 'packing', label: 'one too many' }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('answers "not found" for another user’s trip and for an item of another trip', async () => {
    const { app, trip } = await setup();
    const added = await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: [{ group: 'documents', label: 'Passport' }],
    });
    await expect(app.getChecklist.execute(as(bruno), { tripId: trip.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      app.updateChecklistItem.execute(as(bruno), {
        tripId: trip.id,
        itemId: added.items[0]!.id,
        done: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const other = await app.createTrip.execute(as(ana), { title: 'Peru', startDate: null });
    await expect(
      app.deleteChecklistItem.execute(as(ana), { tripId: other.id, itemId: added.items[0]!.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('keeps labels out of the audit trail', async () => {
    const { app, trip, state } = await setup();
    await app.addChecklistItems.execute(as(ana), {
      tripId: trip.id,
      items: [{ group: 'documents', label: 'Passport number is 12345' }],
    });
    expect(JSON.stringify(state.audit)).not.toContain('12345');
  });
});
