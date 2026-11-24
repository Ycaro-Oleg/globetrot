import { MAX_NIGHTS_PER_DESTINATION, tripDays } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import {
  createApplication,
  EXAMPLE_TRIPS,
  exampleStopName,
  NotFoundError,
  type Actor,
  type UserRecord,
} from '../index';
import { createFakePorts } from '../testing';
import { createTripFromExampleFields } from './operations';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'b@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const as = (user: UserRecord): Actor => ({ kind: 'user', userId: user.id });

function setup() {
  const fake = createFakePorts({ users: [ana, bruno], now: new Date('2026-11-10T12:00:00.000Z') });
  return { ...fake, app: createApplication(fake.ports) };
}

describe('example trips', () => {
  it.each(EXAMPLE_TRIPS.map((trip) => [trip.id, trip] as const))(
    '%s is a valid route the domain can plan',
    (_, trip) => {
      expect(trip.stops.length).toBeGreaterThanOrEqual(2);
      expect(new Set(trip.stops.map((s) => s.placeKey)).size).toBe(trip.stops.length);
      for (const s of trip.stops) {
        expect(s.countryCode).toMatch(/^[A-Z]{2}$/);
        expect(Math.abs(s.latitude)).toBeLessThanOrEqual(90);
        expect(Math.abs(s.longitude)).toBeLessThanOrEqual(180);
        expect(s.nights).toBeLessThanOrEqual(MAX_NIGHTS_PER_DESTINATION);
      }
      const days = tripDays({
        startDate: null,
        stops: trip.stops.map((s) => ({
          id: s.placeKey,
          nights: s.nights,
          state: 'planned',
          places: [],
        })),
      });
      // One day per night, then the departure day.
      expect(days.length).toBe(trip.stops.reduce((sum, s) => sum + s.nights, 0) + 1);
    },
  );

  it('copies the route and nights into a new USD trip of the actor, with the title given', async () => {
    const { app } = setup();
    const trip = await app.createTripFromExample.execute(as(ana), {
      exampleId: 'portugal',
      title: 'Portugal de trem',
    });
    expect(trip).toMatchObject({ title: 'Portugal de trem', currency: 'USD', startDate: null });
    const { destinations } = await app.listDestinations.execute(as(ana), { tripId: trip.id });
    expect(destinations.map((d) => [d.name, d.nights])).toEqual([
      ['Lisbon', 3],
      ['Sintra', 0],
      ['Coimbra', 1],
      ['Porto', 3],
    ]);
    // the copy belongs to Ana only
    await expect(app.getTrip.execute(as(bruno), { id: trip.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('names the stops in Portuguese for a pt-BR copy', async () => {
    const { app } = setup();
    const trip = await app.createTripFromExample.execute(as(ana), {
      exampleId: 'portugal',
      title: 'Portugal de trem',
      locale: 'pt-BR',
    });
    const { destinations } = await app.listDestinations.execute(as(ana), { tripId: trip.id });
    expect(destinations.map((d) => d.name)).toEqual(['Lisboa', 'Sintra', 'Coimbra', 'Porto']);
    expect(exampleStopName(EXAMPLE_TRIPS[0].stops[2], 'pt-BR')).toBe('Quioto');
    expect(exampleStopName(EXAMPLE_TRIPS[0].stops[2], 'en')).toBe('Kyoto');
  });

  it('defaults the title, refuses an unknown example, and replays a retry with the same key', async () => {
    const { app, state } = setup();
    expect(createTripFromExampleFields.safeParse({ exampleId: 'atlantis' }).success).toBe(false);
    const first = await app.createTripFromExample.execute(as(ana), {
      exampleId: 'japan',
      idempotencyKey: 'copy-japan-0001',
    });
    expect(first.title).toBe('Japan in two weeks');
    const again = await app.createTripFromExample.execute(as(ana), {
      exampleId: 'japan',
      idempotencyKey: 'copy-japan-0001',
    });
    expect(again.id).toBe(first.id);
    expect((await app.listTrips.execute(as(ana), {})).trips).toHaveLength(1);
    expect(state.audit.filter((e) => e.action === 'trip.create')).toHaveLength(1);
    expect(state.audit[0]?.metadata).toEqual({ fromExample: 'japan' });
  });
});
