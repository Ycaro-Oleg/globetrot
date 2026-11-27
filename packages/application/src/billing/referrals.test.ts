import { describe, expect, it } from 'vitest';
import { createApplication, createPaymentEvents, type Actor, type UserRecord } from '../index';
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
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });

function setup() {
  const fake = createFakePorts({
    users: [ana, bruno, carla],
    now: new Date('2026-11-27T12:00:00.000Z'),
  });
  for (const who of [ana, bruno, carla])
    fake.state.signedUpAt.set(who.id, new Date('2026-11-26T12:00:00.000Z'));
  return { ...fake, app: createApplication(fake.ports), events: createPaymentEvents(fake.ports) };
}

describe('referrals (ADR-0029)', () => {
  it('gives each person one code, and counts who came through it', async () => {
    const { app } = setup();
    const first = await app.getReferral.execute(as(ana), {});
    expect(first.code).toMatch(/^[A-Z0-9]{8}$/);
    expect((await app.getReferral.execute(as(ana), {})).code).toBe(first.code);
    expect(await app.claimReferral.execute(as(bruno), { code: first.code })).toEqual({
      claimed: true,
    });
    expect(await app.claimReferral.execute(as(bruno), { code: first.code })).toEqual({
      claimed: false,
    });
    expect(await app.getReferral.execute(as(ana), {})).toMatchObject({ joined: 1, passCredits: 0 });
  });

  it('refuses one’s own code, an unknown one, and an account older than a week', async () => {
    const { app, state, setNow } = setup();
    const { code } = await app.getReferral.execute(as(ana), {});
    expect((await app.claimReferral.execute(as(ana), { code })).claimed).toBe(false);
    expect((await app.claimReferral.execute(as(bruno), { code: 'NOPE1234' })).claimed).toBe(false);
    state.signedUpAt.set(carla.id, new Date('2026-11-01T12:00:00.000Z'));
    setNow(new Date('2026-11-27T12:00:00.000Z'));
    expect((await app.claimReferral.execute(as(carla), { code })).claimed).toBe(false);
  });

  it('rewards the referrer with a free pass when the friend first pays, once, and the pass opens a trip', async () => {
    const { app, events, state } = setup();
    const { code } = await app.getReferral.execute(as(ana), {});
    await app.claimReferral.execute(as(bruno), { code });
    const record = {
      plan: 'explorer' as const,
      interval: 'month' as const,
      status: 'active' as const,
      startedAt: new Date('2026-11-27T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-12-27T00:00:00.000Z'),
      providerCustomerId: 'cus_b',
      providerSubscriptionId: 'sub_b',
    };
    await events.apply({ kind: 'subscription', userId: bruno.id, record });
    await events.apply({ kind: 'subscription', userId: bruno.id, record });
    expect((await app.getBilling.execute(as(ana), {})).passCredits).toBe(1);
    const trip = await app.createTrip.execute(as(ana), { title: 'Lisboa', startDate: null });
    await app.redeemPassCredit.execute(as(ana), { tripId: trip.id });
    expect((await app.getBilling.execute(as(ana), {})).passes.map((p) => p.tripId)).toEqual([
      trip.id,
    ]);
    expect((await app.getBilling.execute(as(ana), {})).passCredits).toBe(0);
    await expect(app.redeemPassCredit.execute(as(ana), { tripId: trip.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(state.audit.filter((e) => e.action === 'billing.referral-reward')).toHaveLength(1);
  });

  it('uses a free pass only on one’s own trip', async () => {
    const { app, state } = setup();
    state.passCredits.push({ id: 'c1', userId: bruno.id, ref: 'referral:x', usedTripId: null });
    const anas = await app.createTrip.execute(as(ana), { title: 'Roma', startDate: null });
    await expect(
      app.redeemPassCredit.execute(as(bruno), { tripId: anas.id }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(state.passCredits[0]?.usedTripId).toBeNull();
  });
});
