import { describe, expect, it } from 'vitest';
import { createApplication, type Actor, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const user = (id: string, name: string): UserRecord => ({
  id,
  email: `${id}@example.com`,
  name,
  emailVerified: true,
});
const ana = user('u-ana', 'Ana');
const bruno = user('u-bruno', 'Bruno');
const carla = user('u-carla', 'Carla');
const dani = user('u-dani', 'Dani');
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });
const stop = (name: string, nights: number) => ({
  placeKey: `t:${name}`,
  name,
  countryCode: 'PT',
  latitude: 38.7,
  longitude: -9.1,
  nights,
});

async function setup() {
  const fake = createFakePorts({
    users: [ana, bruno, carla, dani],
    now: new Date('2026-11-27T12:00:00.000Z'),
  });
  fake.state.signedUpAt.set(ana.id, new Date('2026-11-27T12:00:00.000Z'));
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), { title: 'Lisboa', startDate: null });
  const invite = (role: 'editor' | 'viewer' = 'editor') =>
    app.createInvite.execute(as(ana), { tripId: trip.id, role });
  return { ...fake, app, trip, invite };
}

describe('planning a trip together (ADR-0024)', () => {
  it('lets an invited editor see and change the plan, never manage the trip', async () => {
    const { app, trip, invite, state } = await setup();
    const { token } = await invite('editor');
    // The token itself is never stored.
    expect(state.invites[0]?.tokenHash).not.toBe(token);
    expect(await app.previewInvite.execute(as(bruno), { token })).toMatchObject({
      tripTitle: 'Lisboa',
      ownerName: 'Ana',
      role: 'editor',
      joined: false,
    });
    expect(await app.acceptInvite.execute(as(bruno), { token })).toMatchObject({
      id: trip.id,
      role: 'editor',
    });
    await app.replaceDestinations.execute(as(bruno), {
      tripId: trip.id,
      destinations: [stop('Lisboa', 4)],
    });
    expect(
      (await app.listDestinations.execute(as(ana), { tripId: trip.id })).destinations,
    ).toHaveLength(1);
    expect((await app.listTrips.execute(as(bruno), {})).trips).toMatchObject([
      { id: trip.id, role: 'editor' },
    ]);
    await expect(app.archiveTrip.execute(as(bruno), { id: trip.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(app.shareTrip.execute(as(bruno), { tripId: trip.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      app.updateTrip.execute(as(bruno), { id: trip.id, status: 'archived' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets a viewer read but not change, and keeps strangers out as "not found"', async () => {
    const { app, trip, invite } = await setup();
    const { token } = await invite('viewer');
    await app.acceptInvite.execute(as(bruno), { token });
    expect(await app.getTrip.execute(as(bruno), { id: trip.id })).toMatchObject({ role: 'viewer' });
    await expect(
      app.replaceDestinations.execute(as(bruno), { tripId: trip.id, destinations: [] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(app.getTrip.execute(as(carla), { id: trip.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('keeps one guest on the free plan, and accepting twice changes nothing', async () => {
    const { app, invite, setNow } = await setup();
    // After the free week (which allows any number of people), the free plan keeps one guest.
    setNow(new Date('2026-12-20T12:00:00.000Z'));
    const { token } = await invite();
    await app.acceptInvite.execute(as(bruno), { token });
    await app.acceptInvite.execute(as(bruno), { token });
    await expect(app.acceptInvite.execute(as(carla), { token })).rejects.toMatchObject({
      code: 'GUEST_LIMIT_REACHED',
    });
    await expect(invite()).rejects.toMatchObject({ code: 'GUEST_LIMIT_REACHED' });
  });

  it('refuses a revoked, expired or made-up link', async () => {
    const { app, trip, invite, setNow } = await setup();
    const first = await invite();
    const { invites } = await app.getTripMembers.execute(as(ana), { tripId: trip.id });
    await app.revokeInvite.execute(as(ana), { tripId: trip.id, inviteId: invites[0]!.id });
    await expect(app.acceptInvite.execute(as(bruno), { token: first.token })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
    const second = await invite();
    setNow(new Date('2026-12-05T12:00:00.000Z'));
    await expect(
      app.previewInvite.execute(as(bruno), { token: second.token }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      app.acceptInvite.execute(as(bruno), { token: 'A'.repeat(22) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('shows who plans the trip, lets the owner remove someone and a member leave', async () => {
    const { app, trip, invite } = await setup();
    await app.acceptInvite.execute(as(bruno), { token: (await invite()).token });
    await app.acceptInvite.execute(as(carla), { token: (await invite()).token });
    const seen = await app.getTripMembers.execute(as(bruno), { tripId: trip.id });
    expect(seen.members.map((m) => [m.name, m.role, m.you])).toEqual([
      ['Ana', 'owner', false],
      ['Bruno', 'editor', true],
      ['Carla', 'editor', false],
    ]);
    // Only the owner sees the open links.
    expect(seen.invites).toEqual([]);
    await app.removeMember.execute(as(ana), { tripId: trip.id, userId: carla.id });
    await app.leaveTrip.execute(as(bruno), { tripId: trip.id });
    expect((await app.getTripMembers.execute(as(ana), { tripId: trip.id })).members).toHaveLength(
      1,
    );
    await expect(app.getTrip.execute(as(bruno), { id: trip.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      app.removeMember.execute(as(dani), { tripId: trip.id, userId: ana.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps the photos another member added when an editor saves the route', async () => {
    const { app, trip, invite, state } = await setup();
    await app.acceptInvite.execute(as(bruno), { token: (await invite()).token });
    state.media.set('0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a10', {
      id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a10',
      ownerId: ana.id,
      contentType: 'image/jpeg',
      bytes: 10,
      width: 10,
      height: 10,
      createdAt: new Date(),
    } as never);
    await app.replaceDestinations.execute(as(ana), {
      tripId: trip.id,
      destinations: [
        {
          ...stop('Lisboa', 4),
          photos: [{ mediaId: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a10', alt: 'Alfama' }],
        },
      ],
    });
    const saved = await app.replaceDestinations.execute(as(bruno), {
      tripId: trip.id,
      destinations: [
        {
          ...stop('Lisboa', 5),
          photos: [{ mediaId: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a10', alt: 'Alfama' }],
        },
      ],
    });
    expect(saved.destinations[0]?.photos).toHaveLength(1);
  });
});
