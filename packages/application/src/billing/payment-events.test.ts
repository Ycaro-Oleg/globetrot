import { describe, expect, it } from 'vitest';
import { createApplication, createPaymentEvents, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'b@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const record = {
  plan: 'explorer' as const,
  interval: 'month' as const,
  status: 'active' as const,
  startedAt: new Date('2026-11-07T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-12-07T00:00:00.000Z'),
  providerCustomerId: 'cus_1',
  providerSubscriptionId: 'sub_1',
};

function setup() {
  const fake = createFakePorts({ users: [ana, bruno] });
  return { ...fake, events: createPaymentEvents(fake.ports), app: createApplication(fake.ports) };
}

describe('payment events', () => {
  it('records a subscription, then later states of it found by the provider’s id', async () => {
    const { events, state, app } = setup();
    expect(await events.apply({ kind: 'subscription', userId: ana.id, record })).toBe('applied');
    expect(state.subscriptions.get(ana.id)).toEqual(record);
    expect(
      await events.apply({
        kind: 'subscription',
        userId: null,
        record: { ...record, status: 'canceled' },
      }),
    ).toBe('applied');
    expect(state.subscriptions.get(ana.id)?.status).toBe('canceled');
    expect((await app.getBilling.execute({ kind: 'user', userId: ana.id }, {})).access).toBe(
      'explorer',
    );
    expect(state.audit.filter((e) => e.action === 'billing.subscription')).toHaveLength(2);
  });

  it('adds 200 credits once per payment', async () => {
    const { events, state } = setup();
    const topUp = { kind: 'top-up' as const, userId: ana.id, paymentId: 'pi_1' };
    expect(await events.apply(topUp)).toBe('applied');
    expect(await events.apply(topUp)).toBe('duplicate');
    expect(state.credits).toEqual([{ userId: ana.id, delta: 200, reason: 'top-up', ref: 'pi_1' }]);
  });

  it('grants a trip pass once per payment, until 30 days after the trip, only on the buyer’s own trip', async () => {
    const { events, state, app, setNow } = setup();
    setNow(new Date('2027-01-10T12:00:00.000Z'));
    const actor = { kind: 'user' as const, userId: ana.id };
    const trip = await app.createTrip.execute(actor, { title: 'Lisbon', startDate: '2027-03-01' });
    await app.replaceDestinations.execute(actor, {
      tripId: trip.id,
      destinations: [
        {
          placeKey: 'suggest:lisbon',
          name: 'Lisbon',
          countryCode: 'PT',
          latitude: 38.72,
          longitude: -9.14,
          nights: 5,
        },
      ],
    });
    const pass = { kind: 'trip-pass' as const, userId: ana.id, tripId: trip.id, paymentId: 'pi_9' };
    expect(await events.apply(pass)).toBe('applied');
    expect(await events.apply(pass)).toBe('duplicate');
    // The trip ends on 6 March: the pass lasts through 5 April.
    expect(state.passes.map((p) => p.validUntil.toISOString())).toEqual([
      '2027-04-06T00:00:00.000Z',
    ]);
    expect(await events.apply({ ...pass, userId: bruno.id, paymentId: 'pi_10' })).toBe(
      'unknown-account',
    );
    expect(state.audit.filter((e) => e.action === 'billing.trip-pass')).toHaveLength(1);
    expect((await app.getBilling.execute(actor, {})).passes.map((pass) => pass.tripId)).toEqual([
      trip.id,
    ]);
  });

  it('ignores events for accounts it does not know', async () => {
    const { events, state } = setup();
    expect(await events.apply({ kind: 'subscription', userId: null, record })).toBe(
      'unknown-account',
    );
    expect(await events.apply({ kind: 'top-up', userId: 'u-gone', paymentId: 'pi_2' })).toBe(
      'unknown-account',
    );
    expect(state.credits).toHaveLength(0);
  });
});
