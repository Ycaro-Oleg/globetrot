import { describe, expect, it } from 'vitest';
import { createApplication, ValidationError, type Actor } from '../index';
import { createFakePorts } from '../testing';

const ana: Actor = { kind: 'user', userId: 'u-ana' };
const stop = (name: string, extra: Record<string, unknown> = {}) => ({
  placeKey: `test:${name}`,
  name,
  latitude: 35,
  longitude: 135,
  ...extra,
});

describe('stop notes and legs', () => {
  it('keeps a note and the leg to the next stop, drops the leg on the last stop and blank notes', async () => {
    const fake = createFakePorts({
      users: [{ id: 'u-ana', email: 'a@example.com', name: 'Ana', emailVerified: true }],
    });
    const app = createApplication(fake.ports);
    const trip = await app.createTrip.execute(ana, { title: 'Japan', startDate: null });
    const { destinations } = await app.replaceDestinations.execute(ana, {
      tripId: trip.id,
      destinations: [
        stop('Tokyo', { note: '  Ramen in Shinjuku  ', legMode: 'train' }),
        stop('Kyoto', { note: '   ', legMode: 'flight' }),
      ],
    });
    expect(destinations.map((d) => [d.name, d.note, d.legMode])).toEqual([
      ['Tokyo', 'Ramen in Shinjuku', 'train'],
      ['Kyoto', null, null],
    ]);
    // the note stays out of the audit trail
    expect(JSON.stringify(fake.state.audit)).not.toContain('Ramen');
  });

  it('refuses an unknown leg mode and a note that is too long', async () => {
    const fake = createFakePorts({
      users: [{ id: 'u-ana', email: 'a@example.com', name: 'Ana', emailVerified: true }],
    });
    const app = createApplication(fake.ports);
    const trip = await app.createTrip.execute(ana, { title: 'Japan', startDate: null });
    await expect(
      app.replaceDestinations.execute(ana, {
        tripId: trip.id,
        destinations: [stop('Tokyo', { legMode: 'teleport' }), stop('Kyoto')],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      app.replaceDestinations.execute(ana, {
        tripId: trip.id,
        destinations: [stop('Tokyo', { note: 'x'.repeat(501) })],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
