import { describe, expect, it } from 'vitest';
import { createApplication, createPaymentEvents, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
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
  const fake = createFakePorts({ users: [ana] });
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
