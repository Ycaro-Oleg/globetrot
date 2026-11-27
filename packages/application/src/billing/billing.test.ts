import { describe, expect, it } from 'vitest';
import { createApplication, PlanLimitError, type Actor, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });
const signedUp = new Date('2026-11-01T12:00:00.000Z');

function setup(now = '2026-11-03T12:00:00.000Z') {
  const fake = createFakePorts({ users: [ana], now: new Date(now) });
  fake.state.signedUpAt.set(ana.id, signedUp);
  const app = createApplication(fake.ports);
  const newTrip = (title = 'Trip') => app.createTrip.execute(as(ana), { title, startDate: null });
  return { ...fake, app, newTrip };
}

const voyager = {
  plan: 'voyager' as const,
  interval: 'year' as const,
  status: 'active' as const,
  startedAt: new Date('2026-11-05T00:00:00.000Z'),
  currentPeriodEnd: new Date('2027-11-05T00:00:00.000Z'),
  providerCustomerId: null,
  providerSubscriptionId: null,
};

describe('getBilling', () => {
  it('describes the trial: days left, credits, trips', async () => {
    const { app, newTrip } = setup();
    await newTrip();
    expect(await app.getBilling.execute(as(ana), {})).toEqual({
      access: 'trial',
      overLimit: false,
      priceCurrency: 'USD',
      passes: [],
      trialEndsAt: '2026-11-08T12:00:00.000Z',
      trialDaysLeft: 5,
      plan: null,
      interval: null,
      status: null,
      renewsAt: null,
      maxActiveTrips: 10,
      activeTrips: 1,
      countedTrips: 1,
      credits: {
        monthly: 15,
        monthlyLeft: 15,
        topUpLeft: 0,
        total: 15,
        periodEnd: '2026-11-08T12:00:00.000Z',
        dailyCap: 40,
      },
    });
  });

  it('describes a paid plan with monthly credits even when billed yearly', async () => {
    const { app, state, setNow } = setup();
    state.subscriptions.set(ana.id, voyager);
    setNow(new Date('2027-02-10T00:00:00.000Z'));
    expect(await app.getBilling.execute(as(ana), {})).toMatchObject({
      access: 'voyager',
      maxActiveTrips: null,
      renewsAt: '2027-11-05T00:00:00.000Z',
      credits: { monthly: 400, periodEnd: '2027-03-05T00:00:00.000Z' },
    });
  });
});

describe('after the free week, without a plan (ADR-0023)', () => {
  it('stays free for good with one active trip, every tool and 5 Pip credits a month', async () => {
    const { app, newTrip, setNow } = setup();
    const trip = await newTrip();
    setNow(new Date('2026-11-20T00:00:00.000Z'));
    await app.updateTrip.execute(as(ana), { id: trip.id, title: 'Still mine to change' });
    await expect(newTrip()).rejects.toMatchObject({ code: 'TRIP_LIMIT_REACHED' });
    expect(await app.getBilling.execute(as(ana), {})).toMatchObject({
      access: 'free',
      overLimit: false,
      maxActiveTrips: 1,
      credits: { monthly: 5, monthlyLeft: 5, periodEnd: '2026-12-08T12:00:00.000Z' },
    });
  });

  it('waits for changes while more trips than the plan keeps are active, and opens when they are archived', async () => {
    const { app, newTrip, setNow } = setup();
    const first = await newTrip('First');
    const second = await newTrip('Second');
    setNow(new Date('2026-11-20T00:00:00.000Z'));
    await expect(
      app.updateTrip.execute(as(ana), { id: first.id, title: 'New name' }),
    ).rejects.toThrow(PlanLimitError);
    expect((await app.getBilling.execute(as(ana), {})).overLimit).toBe(true);
    // Nothing is lost: both trips are still listed, settings and archiving still work.
    expect((await app.listTrips.execute(as(ana), {})).trips).toHaveLength(2);
    await app.updatePreferences.execute(as(ana), { locale: 'pt-BR' });
    await app.archiveTrip.execute(as(ana), { id: second.id });
    await app.updateTrip.execute(as(ana), { id: first.id, title: 'New name' });
  });

  it('leaves a trip with a pass out of the limit', async () => {
    const { app, newTrip, setNow, state } = setup();
    const first = await newTrip('First');
    const passed = await newTrip('Passed');
    state.passes.push({
      id: 'pass-1',
      tripId: passed.id,
      userId: ana.id,
      purchasedAt: new Date('2026-11-03T12:00:00.000Z'),
      validUntil: new Date('2027-11-03T12:00:00.000Z'),
      providerRef: 'pi_1',
    });
    setNow(new Date('2026-11-20T00:00:00.000Z'));
    await app.updateTrip.execute(as(ana), { id: first.id, title: 'Free trip' });
    await app.updateTrip.execute(as(ana), { id: passed.id, title: 'Passed trip' });
    expect(await app.getBilling.execute(as(ana), {})).toMatchObject({
      overLimit: false,
      activeTrips: 2,
      countedTrips: 1,
      passes: [{ tripId: passed.id, validUntil: '2027-11-03T12:00:00.000Z' }],
    });
  });

  it('opens again with a plan', async () => {
    const { newTrip, setNow, state } = setup();
    await newTrip();
    setNow(new Date('2026-11-09T00:00:00.000Z'));
    state.subscriptions.set(ana.id, { ...voyager, startedAt: new Date('2026-11-08T00:00:00Z') });
    await expect(newTrip()).resolves.toMatchObject({ title: 'Trip' });
  });
});

describe('active trip limits', () => {
  it('keeps 10 active trips in the trial; archived ones do not count, restoring one does', async () => {
    const { app, newTrip } = setup();
    const trips = [];
    for (let n = 0; n < 10; n++) trips.push(await newTrip(`Trip ${n}`));
    await expect(newTrip()).rejects.toMatchObject({ code: 'TRIP_LIMIT_REACHED' });
    await app.archiveTrip.execute(as(ana), { id: trips[0]!.id });
    await newTrip('Room again');
    await expect(
      app.updateTrip.execute(as(ana), { id: trips[0]!.id, status: 'active' }),
    ).rejects.toMatchObject({ code: 'TRIP_LIMIT_REACHED' });
  });

  it('has no limit on Voyager', async () => {
    const { newTrip, state } = setup();
    state.subscriptions.set(ana.id, voyager);
    state.signedUpAt.set(ana.id, new Date('2026-11-01T00:00:00Z'));
    for (let n = 0; n < 12; n++) await newTrip(`Trip ${n}`);
  });
});

describe('checkout', () => {
  it('says payments are not on until the provider is configured, then opens it, even over the limit', async () => {
    const { app, payments, setNow, newTrip } = setup();
    await newTrip('One');
    await newTrip('Two');
    await expect(app.startCheckout.execute(as(ana), { item: 'explorer' })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    payments.enabled = true;
    setNow(new Date('2026-12-01T00:00:00.000Z'));
    expect(await app.startCheckout.execute(as(ana), { item: 'voyager', interval: 'year' })).toEqual(
      {
        url: 'https://pay.example.test/checkout?item=voyager&interval=year&currency=USD',
      },
    );
  });

  it('charges in reais only for someone who chose reais, and sells a pass only for one’s own trip', async () => {
    const { app, payments, newTrip } = setup();
    payments.enabled = true;
    const trip = await newTrip();
    await app.updatePreferences.execute(as(ana), { currency: 'BRL' });
    expect((await app.getBilling.execute(as(ana), {})).priceCurrency).toBe('BRL');
    expect(
      await app.startCheckout.execute(as(ana), { item: 'trip-pass', tripId: trip.id }),
    ).toEqual({
      url: `https://pay.example.test/checkout?item=trip-pass&interval=month&currency=BRL&trip=${trip.id}`,
    });
    await expect(
      app.startCheckout.execute(as(ana), {
        item: 'trip-pass',
        tripId: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a02',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(app.startCheckout.execute(as(ana), { item: 'trip-pass' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('has no payment page to manage before the first payment', async () => {
    const { app, payments, state } = setup();
    payments.enabled = true;
    await expect(app.openBillingPortal.execute(as(ana), {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    state.subscriptions.set(ana.id, { ...voyager, providerCustomerId: 'cus_1' });
    expect(await app.openBillingPortal.execute(as(ana), {})).toEqual({
      url: 'https://pay.example.test/portal/cus_1',
    });
  });
});
