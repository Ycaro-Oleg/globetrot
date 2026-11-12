import { describe, expect, it } from 'vitest';
import { createApplication, ValidationError, type Actor } from '../index';
import { createFakePorts } from '../testing';

const ana: Actor = { kind: 'user', userId: 'u-ana' };
const leo: Actor = { kind: 'user', userId: 'u-leo' };
const users = [
  { id: 'u-ana', email: 'a@example.com', name: 'Ana', emailVerified: true },
  { id: 'u-leo', email: 'l@example.com', name: 'Leo', emailVerified: true },
];
const stop = (name: string, countryCode: string | null, extra: Record<string, unknown> = {}) => ({
  placeKey: `test:${name}`,
  name,
  countryCode,
  latitude: 35,
  longitude: 135,
  ...extra,
});

function setup() {
  const fake = createFakePorts({ users });
  const app = createApplication(fake.ports);
  return { fake, app };
}

describe('stop spots, todos and visited', () => {
  it('stores spots and todos with their defaults, and keeps them out of the audit trail', async () => {
    const { fake, app } = setup();
    const trip = await app.createTrip.execute(ana, { title: 'Japan', startDate: null });
    const { destinations } = await app.replaceDestinations.execute(ana, {
      tripId: trip.id,
      destinations: [
        stop('Kyoto', 'JP', {
          spots: [
            { name: ' Fushimi Inari ', latitude: 34.97, longitude: 135.77 },
            { name: 'Gion' },
          ],
          todos: [{ text: 'Book the ryokan', done: true }],
        }),
      ],
    });
    expect(destinations[0]).toMatchObject({
      visited: false,
      spots: [
        { name: 'Fushimi Inari', latitude: 34.97, longitude: 135.77, done: false },
        { name: 'Gion', latitude: null, longitude: null, done: false },
      ],
      todos: [{ text: 'Book the ryokan', done: true }],
    });
    const listed = await app.listDestinations.execute(ana, { tripId: trip.id });
    expect(listed.destinations[0]!.spots).toHaveLength(2);
    expect(JSON.stringify(fake.state.audit)).not.toMatch(/Fushimi|ryokan/);
  });

  it('refuses blank spots, too many todos and text that is too long', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(ana, { title: 'Japan', startDate: null });
    const replace = (extra: Record<string, unknown>) =>
      app.replaceDestinations.execute(ana, {
        tripId: trip.id,
        destinations: [stop('Kyoto', 'JP', extra)],
      });
    await expect(replace({ spots: [{ name: '  ' }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      replace({ todos: Array.from({ length: 31 }, (_, i) => ({ text: `t${i}` })) }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(replace({ todos: [{ text: 'x'.repeat(121) }] })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('commemorative visas', () => {
  it('stamps one visa per country on the first visited stop, and only once', async () => {
    const { fake, app } = setup();
    const trip = await app.createTrip.execute(ana, { title: 'Japan', startDate: null });
    const route = (visited: boolean[]) =>
      app.replaceDestinations.execute(ana, {
        tripId: trip.id,
        destinations: [
          stop('Tokyo', 'JP', { visited: visited[0] }),
          stop('Kyoto', 'JP', { visited: visited[1] }),
          stop('Seoul', 'KR', { visited: visited[2] }),
          stop('Somewhere', null, { visited: true }),
        ],
      });

    const none = await route([false, false, false]);
    expect(none.stampedVisas).toEqual([]);

    const first = await route([false, true, false]);
    expect(first.stampedVisas).toEqual([
      { countryCode: 'JP', city: 'Kyoto', stampedAt: '2026-11-07T12:00:00.000Z' },
    ]);
    expect(first.destinations.map((d) => d.visited)).toEqual([false, true, false, true]);

    // Japan already has its visa; Korea gets one.
    const second = await route([true, true, true]);
    expect(second.stampedVisas.map((v) => v.countryCode)).toEqual(['KR']);

    // Un-visiting keeps the visa (it is a souvenir, never taken back).
    const third = await route([false, false, false]);
    expect(third.stampedVisas).toEqual([]);
    const { visas } = await app.listVisas.execute(ana, {});
    expect(visas.map((v) => v.countryCode).sort()).toEqual(['JP', 'KR']);

    // The audit says how many, never which countries or cities.
    const stamps = fake.state.audit.filter((event) => event.action === 'visa.stamp');
    expect(stamps.map((event) => event.metadata)).toEqual([{ count: 1 }, { count: 1 }]);
    expect(JSON.stringify(fake.state.audit)).not.toMatch(/Kyoto|Seoul|"KR"|"JP"/);
  });

  it('lists only the caller’s own visas', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(ana, { title: 'Japan', startDate: null });
    await app.replaceDestinations.execute(ana, {
      tripId: trip.id,
      destinations: [stop('Kyoto', 'JP', { visited: true })],
    });
    expect((await app.listVisas.execute(leo, {})).visas).toEqual([]);
    expect((await app.listVisas.execute(ana, {})).visas).toHaveLength(1);
  });
});
