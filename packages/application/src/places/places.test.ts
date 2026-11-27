import { describe, expect, it } from 'vitest';
import {
  createApplication,
  PLACE_LOOKUPS_PER_MINUTE,
  RateLimitedError,
  UnavailableError,
  ValidationError,
  type Actor,
} from '../index';
import { createFakePorts } from '../testing';

const ana: Actor = { kind: 'user', userId: 'u-ana' };
const users = [{ id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true }];

describe('place search', () => {
  it('finds places through the geocoder and the point lookup', async () => {
    const fake = createFakePorts({ users });
    const app = createApplication(fake.ports);
    const { places } = await app.searchPlaces.execute(ana, { query: 'kyo', language: 'pt-BR' });
    expect(places.map((place) => place.name)).toEqual(['Kyoto']);
    expect(places[0]?.attribution).toContain('OpenStreetMap');
    const near = await app.reversePlace.execute(ana, { latitude: 35.1, longitude: 135.8 });
    expect(near.place?.key).toBe('fake:kyoto');
    const sea = await app.reversePlace.execute(ana, { latitude: 0, longitude: 0 });
    expect(sea.place).toBeNull();
  });

  it('refuses a one-letter query and says when the provider is unavailable', async () => {
    const fake = createFakePorts({ users });
    const app = createApplication(fake.ports);
    await expect(app.searchPlaces.execute(ana, { query: 'k' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    fake.places.offline = true;
    // A small place the built-in list does not know: search says it is unavailable.
    await expect(app.searchPlaces.execute(ana, { query: 'Shirakawa-go' })).rejects.toBeInstanceOf(
      UnavailableError,
    );
    await expect(
      app.reversePlace.execute(ana, { latitude: 35, longitude: 135 }),
    ).rejects.toBeInstanceOf(UnavailableError);
  });

  it('falls back to popular destinations when the provider is down, named in the person’s language', async () => {
    const fake = createFakePorts({ users });
    const app = createApplication(fake.ports);
    fake.places.offline = true;
    // Kyoto is not in the (test) city index, so the popular list answers, in the person's language.
    const { places } = await app.searchPlaces.execute(ana, { query: 'quio', language: 'pt-BR' });
    expect(places[0]).toMatchObject({
      key: 'gt:kyoto',
      name: 'Quioto',
      countryCode: 'JP',
      attribution: 'Globetrot',
    });
  });

  it('finds cities in the built-in index, bigger first, and a name typed in another language', async () => {
    const fake = createFakePorts({ users });
    const app = createApplication(fake.ports);
    const fortaleza = await app.searchCities.execute(ana, { query: 'Fortal', language: 'pt-BR' });
    expect(fortaleza.places[0]).toMatchObject({
      key: 'gn:6320062',
      name: 'Fortaleza',
      region: 'Ceará',
      countryCode: 'BR',
      attribution: 'GeoNames',
    });
    const london = await app.searchCities.execute(ana, { query: 'Londres', language: 'pt-BR' });
    expect(london.places[0]).toMatchObject({ name: 'Londres', countryCode: 'GB' });
  });

  it('searches the city index when the provider is down, before the popular list', async () => {
    const fake = createFakePorts({ users });
    const app = createApplication(fake.ports);
    fake.places.offline = true;
    const { places } = await app.searchPlaces.execute(ana, { query: 'Fortaleza' });
    expect(places[0]).toMatchObject({ key: 'gn:6320062', attribution: 'GeoNames' });
  });

  it('limits how often one person can look places up', async () => {
    const fake = createFakePorts({ users });
    const app = createApplication(fake.ports);
    for (let i = 0; i < PLACE_LOOKUPS_PER_MINUTE; i++) {
      await app.searchPlaces.execute(ana, { query: 'kyoto' });
    }
    await expect(app.searchPlaces.execute(ana, { query: 'kyoto' })).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });
});
