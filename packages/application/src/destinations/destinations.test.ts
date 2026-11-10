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

const KYOTO = {
  placeKey: 'catalog:kyoto',
  name: 'Kyoto',
  countryCode: 'JP',
  region: 'Kansai',
  latitude: 35.01,
  longitude: 135.77,
  nights: 3,
};
const TOKYO = {
  placeKey: 'catalog:tokyo',
  name: 'Tokyo',
  countryCode: 'JP',
  latitude: 35.68,
  longitude: 139.69,
  nights: 4,
};

async function setup() {
  const fake = createFakePorts({ users: [ana, bruno] });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), { title: 'Japan 2027' });
  return { ...fake, app, trip };
}

describe('replaceDestinations and listDestinations', () => {
  it('starts with an empty route', async () => {
    const { app, trip } = await setup();
    expect(await app.listDestinations.execute(as(ana), { tripId: trip.id })).toEqual({
      destinations: [],
    });
  });

  it('stores the route in the order sent, with ids and positions chosen by the server', async () => {
    const { app, trip } = await setup();
    const saved = await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [TOKYO, KYOTO],
    });
    expect(saved.destinations.map((stop) => [stop.position, stop.name, stop.nights])).toEqual([
      [0, 'Tokyo', 4],
      [1, 'Kyoto', 3],
    ]);
    expect(saved.destinations[1]).toMatchObject({
      countryCode: 'JP',
      region: 'Kansai',
      placeKey: 'catalog:kyoto',
    });
    expect(saved.destinations[0]?.region).toBeNull();
    for (const stop of saved.destinations) expect(stop.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await app.listDestinations.execute(as(ana), { tripId: trip.id })).toEqual(saved);
  });

  it('replaces the whole route: reordering, removing and clearing', async () => {
    const { app, trip } = await setup();
    await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [TOKYO, KYOTO],
    });
    const reordered = await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [KYOTO, TOKYO],
    });
    expect(reordered.destinations.map((stop) => stop.name)).toEqual(['Kyoto', 'Tokyo']);
    const one = await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [KYOTO],
    });
    expect(one.destinations).toHaveLength(1);
    const cleared = await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [],
    });
    expect(cleared.destinations).toEqual([]);
  });

  it('defaults nights to 0 and the optional fields to null', async () => {
    const { app, trip } = await setup();
    const { destinations } = await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [{ placeKey: 'x', name: 'Somewhere', latitude: 1, longitude: 2 } as never],
    });
    expect(destinations[0]).toMatchObject({ nights: 0, countryCode: null, region: null });
  });

  it('answers "not found" for someone else’s trip and for a missing one, and changes nothing', async () => {
    const { app, trip, state } = await setup();
    const missing = '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d9e';
    for (const tripId of [trip.id, missing]) {
      await expect(
        app.replaceDestinations.execute(as(bruno), { tripId, destinations: [KYOTO] }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(app.listDestinations.execute(as(bruno), { tripId })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    }
    expect(state.destinations.size).toBe(0);
  });

  it.each([
    ['a latitude out of range', { ...KYOTO, latitude: 91 }, 'destinations.0.latitude'],
    ['a longitude out of range', { ...KYOTO, longitude: -181 }, 'destinations.0.longitude'],
    ['negative nights', { ...KYOTO, nights: -1 }, 'destinations.0.nights'],
    ['fractional nights', { ...KYOTO, nights: 1.5 }, 'destinations.0.nights'],
    ['too many nights', { ...KYOTO, nights: 366 }, 'destinations.0.nights'],
    ['an empty name', { ...KYOTO, name: '   ' }, 'destinations.0.name'],
    ['a lower-case country', { ...KYOTO, countryCode: 'jp' }, 'destinations.0.countryCode'],
    ['an empty key', { ...KYOTO, placeKey: '' }, 'destinations.0.placeKey'],
  ])('rejects %s and saves nothing', async (_name, stop, field) => {
    const { app, trip, state } = await setup();
    const error = await app.replaceDestinations
      .execute(as(ana), { tripId: trip.id, destinations: [stop as never] })
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues.map((issue) => issue.field)).toContain(field);
    expect(state.destinations.size).toBe(0);
  });

  it('refuses more than 100 stops', async () => {
    const { app, trip } = await setup();
    const many = Array.from({ length: 101 }, (_, i) => ({ ...KYOTO, placeKey: `k${i}` }));
    await expect(
      app.replaceDestinations.execute(as(ana), { tripId: trip.id, destinations: many }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('audits how many stops, never which places', async () => {
    const { app, trip, state } = await setup();
    await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [TOKYO, KYOTO],
    });
    const event = state.audit.at(-1);
    expect(event).toMatchObject({
      action: 'destination.replace',
      entityType: 'trip',
      entityId: trip.id,
      metadata: { count: 2 },
    });
    expect(JSON.stringify(event)).not.toContain('Kyoto');
  });

  it('rolls the route back when the audit write fails', async () => {
    const { app, trip, state, faults } = await setup();
    await app.replaceDestinations.execute(as(ana), { tripId: trip.id, destinations: [TOKYO] });
    faults.auditFails = true;
    await expect(
      app.replaceDestinations.execute(as(ana), { tripId: trip.id, destinations: [KYOTO] }),
    ).rejects.toThrow();
    expect((state.destinations.get(trip.id) ?? []).map((stop) => stop.name)).toEqual(['Tokyo']);
  });
});
