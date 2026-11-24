import { describe, expect, it } from 'vitest';
import { createApplication, createSharedTrips, type Actor, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = {
  id: 'u-ana',
  email: 'ana@example.com',
  name: 'Ana Secret',
  emailVerified: true,
};
const leo: UserRecord = { id: 'u-leo', email: 'leo@example.com', name: 'Leo', emailVerified: true };
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
  const fake = createFakePorts({ users: [ana, leo] });
  const app = createApplication(fake.ports);
  const shared = createSharedTrips(fake.ports);
  const trip = await app.createTrip.execute(as(ana), {
    title: 'Portugal',
    startDate: '2027-03-14',
  });
  await app.replaceDestinations.execute(as(ana), {
    tripId: trip.id,
    destinations: [stop('Lisbon', 4), stop('Porto', 3)],
  });
  await app.createExpense.execute(as(ana), {
    tripId: trip.id,
    category: 'flights',
    status: 'estimate',
    description: 'Flights',
    amount: '1000.00',
    currency: 'USD',
  });
  await app.updateSavings.execute(as(ana), { tripId: trip.id, saved: '250.00', monthly: '250.00' });
  return { ...fake, app, shared, trip };
}

describe('the shared page language', () => {
  it('is the owner’s language, so the social card matches the title they wrote', async () => {
    const { app, shared, trip } = await setup();
    await app.updatePreferences.execute(as(ana), { locale: 'pt-BR' });
    const { slug } = await app.shareTrip.execute(as(ana), { tripId: trip.id, showAmounts: false });
    expect((await shared.view(slug!))?.locale).toBe('pt-BR');
  });
});

describe('sharing a trip', () => {
  it('shows the route, the month only and the answer, never the name, and amounts only when chosen', async () => {
    const { app, shared, trip } = await setup();
    const { slug } = await app.shareTrip.execute(as(ana), { tripId: trip.id });
    const page = await shared.view(slug!);
    expect(page).toMatchObject({
      title: 'Portugal',
      // No saved preferences yet: the owner's language falls back to the default.
      locale: 'en',
      startMonth: '2027-03',
      totalNights: 7,
      stops: [
        { name: 'Lisbon', nights: 4 },
        { name: 'Porto', nights: 3 },
      ],
      savings: { status: 'saving', progressBasisPoints: 2500 },
      amounts: null,
    });
    expect(JSON.stringify(page)).not.toMatch(/Ana|ana@|2027-03-14/);

    const again = await app.shareTrip.execute(as(ana), { tripId: trip.id, showAmounts: true });
    expect(again.slug).toBe(slug);
    expect((await shared.view(slug!))?.amounts).toMatchObject({
      total: { amount: '1000.00', currency: 'USD' },
      saved: { amount: '250.00' },
    });
  });

  it('stops for good when turned off, and even when the account is read-only', async () => {
    const { app, shared, trip, setNow, state } = await setup();
    state.signedUpAt.set(ana.id, new Date('2026-11-07T00:00:00.000Z'));
    const { slug } = await app.shareTrip.execute(as(ana), { tripId: trip.id });
    setNow(new Date('2026-12-30T00:00:00.000Z'));
    await expect(app.shareTrip.execute(as(ana), { tripId: trip.id })).rejects.toMatchObject({
      code: 'PLAN_REQUIRED',
    });
    expect(await app.unshareTrip.execute(as(ana), { tripId: trip.id })).toEqual({
      slug: null,
      showAmounts: false,
    });
    expect(await shared.view(slug!)).toBeNull();
    expect(await app.getTripShare.execute(as(ana), { tripId: trip.id })).toEqual({
      slug: null,
      showAmounts: false,
    });
  });

  it('answers nothing for a made-up or malformed link, an archived trip, or someone else’s trip', async () => {
    const { app, shared, trip } = await setup();
    expect(await shared.view('x')).toBeNull();
    expect(await shared.view('A'.repeat(22))).toBeNull();
    const { slug } = await app.shareTrip.execute(as(ana), { tripId: trip.id });
    await app.archiveTrip.execute(as(ana), { id: trip.id });
    expect(await shared.view(slug!)).toBeNull();
    await expect(app.shareTrip.execute(as(leo), { tripId: trip.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
