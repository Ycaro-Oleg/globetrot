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
      readOnly: false,
      trialEndsAt: '2026-11-08T12:00:00.000Z',
      trialDaysLeft: 5,
      plan: null,
      interval: null,
      status: null,
      renewsAt: null,
      maxActiveTrips: 10,
      activeTrips: 1,
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

describe('after the trial, without a plan', () => {
  it('is read-only: changes are refused, reading, settings, export and leaving still work', async () => {
    const { app, newTrip, setNow } = setup();
    const trip = await newTrip();
    setNow(new Date('2026-11-09T00:00:00.000Z'));
    await expect(newTrip()).rejects.toMatchObject({ code: 'PLAN_REQUIRED' });
    await expect(
      app.updateTrip.execute(as(ana), { id: trip.id, title: 'New name' }),
    ).rejects.toThrow(PlanLimitError);
    expect((await app.listTrips.execute(as(ana), {})).trips).toHaveLength(1);
    expect((await app.getBilling.execute(as(ana), {})).readOnly).toBe(true);
    await app.updatePreferences.execute(as(ana), { locale: 'pt-BR' });
    await app.archiveTrip.execute(as(ana), { id: trip.id });
  });

  it('opens again with a plan', async () => {
    const { newTrip, setNow, state } = setup();
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
  it('says payments are not on until the provider is configured, then opens it, even when read-only', async () => {
    const { app, payments, setNow } = setup();
    await expect(app.startCheckout.execute(as(ana), { item: 'explorer' })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    payments.enabled = true;
    setNow(new Date('2026-12-01T00:00:00.000Z'));
    expect(await app.startCheckout.execute(as(ana), { item: 'voyager', interval: 'year' })).toEqual(
      {
        url: 'https://pay.example.test/checkout?item=voyager&interval=year',
      },
    );
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
