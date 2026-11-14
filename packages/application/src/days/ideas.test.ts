import { describe, expect, it } from 'vitest';
import { createApplication, type Actor, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const leo: UserRecord = { id: 'u-leo', email: 'leo@example.com', name: 'Leo', emailVerified: true };
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });

async function setup(stops: { placeKey: string; name: string }[]) {
  const fake = createFakePorts({ users: [ana, leo] });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), { title: 'Trip', startDate: null });
  const { destinations } = await app.replaceDestinations.execute(as(ana), {
    tripId: trip.id,
    destinations: stops.map((stop) => ({
      ...stop,
      countryCode: 'PT',
      latitude: 38.7,
      longitude: -9.1,
      nights: 2,
    })),
  });
  return { ...fake, app, trip, destinations };
}

describe('day ideas', () => {
  it('uses the built-in list for a popular city, in the person’s language, without what is already planned', async () => {
    const { app, trip, destinations } = await setup([{ placeKey: 'gt:lisbon', name: 'Lisboa' }]);
    await app.addDayPlace.execute(as(ana), {
      tripId: trip.id,
      name: 'Alfama',
      destinationId: destinations[0]!.id,
      minutes: 60,
    });
    const { stops } = await app.suggestDayPlaces.execute(as(ana), {
      tripId: trip.id,
      language: 'pt-BR',
    });
    expect(stops[0]).toMatchObject({
      stopId: destinations[0]!.id,
      source: 'built-in',
      attribution: null,
    });
    const names = stops[0]!.ideas.map((idea) => idea.name);
    expect(names).toContain('Torre de Belém');
    expect(names).not.toContain('Alfama');
    expect(stops[0]!.ideas.find((idea) => idea.name === 'Torre de Belém')).toEqual({
      name: 'Torre de Belém',
      kind: 'landmark',
      minutes: 60,
    });
  });

  it('recognises a popular city by name when the stop came from the provider', async () => {
    const { app, trip } = await setup([{ placeKey: 'geoapify:abc', name: 'Paris' }]);
    const { stops } = await app.suggestDayPlaces.execute(as(ana), {
      tripId: trip.id,
      language: 'en',
    });
    expect(stops[0]!.ideas[0]).toMatchObject({ name: 'Eiffel Tower', minutes: 60 });
  });

  it('prefers the places provider, with its credit, and offers nothing for an unknown town without it', async () => {
    const { app, trip, places } = await setup([{ placeKey: 'geoapify:x', name: 'Óbidos' }]);
    expect(
      (await app.suggestDayPlaces.execute(as(ana), { tripId: trip.id, language: 'en' })).stops[0],
    ).toMatchObject({ ideas: [], source: null });
    places.sights = [
      { name: 'Óbidos Castle', kind: 'landmark', attribution: '© OSM' },
      { name: 'Town walls', kind: 'viewpoint', attribution: '© OSM' },
    ];
    expect(
      (await app.suggestDayPlaces.execute(as(ana), { tripId: trip.id, language: 'en' })).stops[0],
    ).toMatchObject({
      source: 'provider',
      attribution: '© OSM',
      ideas: [
        { name: 'Óbidos Castle', minutes: 60 },
        { name: 'Town walls', minutes: 45 },
      ],
    });
  });

  it('is the owner’s alone, and rate limited', async () => {
    const { app, trip } = await setup([{ placeKey: 'gt:rome', name: 'Rome' }]);
    await expect(
      app.suggestDayPlaces.execute(as(leo), { tripId: trip.id, language: 'en' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    for (let n = 0; n < 20; n++)
      await app.suggestDayPlaces.execute(as(ana), { tripId: trip.id, language: 'en' });
    await expect(
      app.suggestDayPlaces.execute(as(ana), { tripId: trip.id, language: 'en' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
