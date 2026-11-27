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
const stop = (name: string, nights: number) => ({
  placeKey: `test:${name}`,
  name,
  latitude: 35,
  longitude: 135,
  nights,
});

/** Tokyo 2 nights (days 1–2), Kyoto 1 night (day 3). */
async function setup() {
  const fake = createFakePorts({ users: [ana, bruno], now: new Date('2026-11-13T12:00:00.000Z') });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), { title: 'Japan', startDate: null });
  const { destinations } = await app.replaceDestinations.execute(as(ana), {
    tripId: trip.id,
    destinations: [stop('Tokyo', 2), stop('Kyoto', 1)],
  });
  const [tokyo, kyoto] = destinations;
  const add = (name: string, destinationId: string | null = tokyo!.id, minutes = 120) =>
    app.addDayPlace.execute(as(ana), { tripId: trip.id, name, destinationId, minutes });
  return { ...fake, app, trip, tokyo: tokyo!, kyoto: kyoto!, add };
}

describe('day plan', () => {
  it('adds places to "No day", in the order they were added', async () => {
    const { add } = await setup();
    await add('Senso-ji');
    const plan = await add('  Shibuya Crossing  ', null, 60);
    expect(plan.places.map((p) => [p.name, p.day, p.minutes])).toEqual([
      ['Senso-ji', null, 120],
      ['Shibuya Crossing', null, 60],
    ]);
    expect(plan.places[1]?.destinationId).toBeNull();
  });

  it('moves a place to a day, to the end of it or before another place, and back to "No day"', async () => {
    const { app, trip, add } = await setup();
    await add('A');
    await add('B');
    const plan = await add('C');
    const [a, b, c] = plan.places.map((p) => p.id) as [string, string, string];
    const move = (placeId: string, day: number | null, beforeId?: string) =>
      app.moveDayPlace.execute(as(ana), {
        tripId: trip.id,
        placeId,
        day,
        ...(beforeId ? { beforeId } : {}),
      });
    await move(a, 1);
    await move(b, 1);
    let result = await move(c, 1, a);
    expect(result.places.filter((p) => p.day === 1).map((p) => p.name)).toEqual(['C', 'A', 'B']);
    result = await move(a, null);
    expect(result.places.filter((p) => p.day === null).map((p) => p.name)).toEqual(['A']);
    expect(result.places.filter((p) => p.day === 1).map((p) => p.name)).toEqual(['C', 'B']);
  });

  it('refuses a day the route does not have, and a "before" place on another day', async () => {
    const { app, trip, add } = await setup();
    await add('A');
    const plan = await add('B');
    const [a, b] = plan.places.map((p) => p.id) as [string, string];
    await expect(
      // Three nights make four days (the last is the departure day): there is no day 5.
      app.moveDayPlace.execute(as(ana), { tripId: trip.id, placeId: a, day: 5 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await app.moveDayPlace.execute(as(ana), { tripId: trip.id, placeId: b, day: 2 });
    await expect(
      app.moveDayPlace.execute(as(ana), { tripId: trip.id, placeId: a, day: 1, beforeId: b }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reads a removed stop as none and a day past the route as "No day", without losing the place', async () => {
    const { app, trip, add, kyoto } = await setup();
    const plan = await add('Fushimi Inari', kyoto.id);
    const id = plan.places[0]!.id;
    await app.moveDayPlace.execute(as(ana), { tripId: trip.id, placeId: id, day: 4 });
    // Kyoto is dropped from the route: two nights make three days, so day 4 is gone, and so is the stop.
    await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [stop('Tokyo', 2)],
    });
    const after = await app.listDayPlaces.execute(as(ana), { tripId: trip.id });
    expect(after.places).toEqual([
      { id, name: 'Fushimi Inari', minutes: 120, day: null, destinationId: null },
    ]);
  });

  it('refuses an unknown stop, a blank name and a time outside 15 minutes to 12 hours', async () => {
    const { add } = await setup();
    await expect(add('X', '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d01')).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(add('   ')).rejects.toBeInstanceOf(ValidationError);
    await expect(add('X', null, 5)).rejects.toBeInstanceOf(ValidationError);
    await expect(add('X', null, 800)).rejects.toBeInstanceOf(ValidationError);
  });

  it('keeps a place on its stop when the route is saved again (the stop keeps its id)', async () => {
    const { app, trip, add, tokyo } = await setup();
    await add('Senso-ji', tokyo.id);
    const { destinations } = await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [stop('Kyoto', 1), stop('Tokyo', 3)],
    });
    expect(destinations.find((d) => d.name === 'Tokyo')?.id).toBe(tokyo.id);
    const plan = await app.listDayPlaces.execute(as(ana), { tripId: trip.id });
    expect(plan.places[0]?.destinationId).toBe(tokyo.id);
  });

  it('removes a place; another person sees "not found" and the audit keeps no names', async () => {
    const { app, trip, add, state } = await setup();
    const plan = await add('Golden Gai');
    const id = plan.places[0]!.id;
    await expect(
      app.moveDayPlace.execute(as(bruno), { tripId: trip.id, placeId: id, day: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(app.listDayPlaces.execute(as(bruno), { tripId: trip.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const after = await app.removeDayPlace.execute(as(ana), { tripId: trip.id, placeId: id });
    expect(after.places).toEqual([]);
    expect(JSON.stringify(state.audit)).not.toContain('Golden Gai');
  });

  it('earns "every day has a plan" once each day of the route has a place', async () => {
    const { app, trip, add } = await setup();
    const ids: string[] = [];
    for (const name of ['A', 'B', 'C']) ids.push((await add(name)).places.at(-1)!.id);
    let readiness = (await app.getChecklist.execute(as(ana), { tripId: trip.id })).readiness;
    expect(readiness.itin).toBe(false);
    for (const [index, id] of ids.entries()) {
      await app.moveDayPlace.execute(as(ana), { tripId: trip.id, placeId: id, day: index + 1 });
    }
    readiness = (await app.getChecklist.execute(as(ana), { tripId: trip.id })).readiness;
    expect(readiness.itin).toBe(true);
  });
});
