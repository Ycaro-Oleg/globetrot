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
    await expect(app.searchPlaces.execute(ana, { query: 'kyoto' })).rejects.toBeInstanceOf(
      UnavailableError,
    );
    await expect(
      app.reversePlace.execute(ana, { latitude: 35, longitude: 135 }),
    ).rejects.toBeInstanceOf(UnavailableError);
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
