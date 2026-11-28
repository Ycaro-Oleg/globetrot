import { describe, expect, it } from 'vitest';
import {
  createApplication,
  createPaymentEvents,
  NotFoundError,
  UnavailableError,
  ValidationError,
  type Actor,
  type UserRecord,
} from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'Ana@Example.com', name: 'Ana', emailVerified: true };
const leo: UserRecord = { id: 'u-leo', email: 'leo@example.com', name: 'Leo', emailVerified: true };
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });

function setup() {
  const fake = createFakePorts({ users: [ana, leo] });
  return { ...fake, app: createApplication(fake.ports) };
}

describe('account export', () => {
  it('holds the person’s own data and nobody else’s', async () => {
    const { app } = setup();
    await app.createTrip.execute(as(ana), { title: 'Japan', startDate: null });
    await app.createTrip.execute(as(leo), { title: 'Leo’s secret trip', startDate: null });
    const exported = await app.exportAccount.execute(as(ana), {});
    expect(exported).toMatchObject({ format: 'globetrot-account-export', version: 1 });
    const text = JSON.stringify(exported);
    expect(text).toContain('Japan');
    expect(text).not.toContain('Leo’s secret trip');
  });
});

describe('account deletion', () => {
  it('needs the account’s email typed again (any case)', async () => {
    const { app } = setup();
    await expect(
      app.deleteAccount.execute(as(ana), { confirmEmail: 'leo@example.com' }),
    ).rejects.toThrow(ValidationError);
    await expect(
      app.deleteAccount.execute(as(ana), { confirmEmail: ' ana@example.COM ' }),
    ).resolves.toEqual({ ok: true });
  });

  it('removes trips, community data and uploads, and records it without personal data', async () => {
    const { app, state } = setup();
    await app.createTrip.execute(as(ana), { title: 'Japan', startDate: null });
    await app.createPost.execute(as(ana), { kind: 'tip', body: 'hello' });
    await app.deleteAccount.execute(as(ana), { confirmEmail: 'ana@example.com' });
    expect([...state.trips.values()].some((t) => t.ownerId === ana.id)).toBe(false);
    expect([...state.community.posts.values()]).toEqual([]);
    const event = state.audit.find((e) => e.action === 'account.delete');
    expect(event?.metadata).toEqual({ uploads: 0, subscription: 'none' });
    expect(JSON.stringify(event)).not.toContain('example.com');
    await expect(app.exportAccount.execute(as(ana), {})).rejects.toThrow(NotFoundError);
  });
});

describe('account deletion with a subscription (#201)', () => {
  const subscribe = (
    state: ReturnType<typeof setup>['state'],
    status: 'active' | 'past_due' | 'canceled',
  ) =>
    state.subscriptions.set(ana.id, {
      plan: 'explorer',
      interval: 'month',
      status,
      startedAt: new Date('2026-11-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
      providerCustomerId: 'cus_ana',
      providerSubscriptionId: 'sub_ana',
    });

  it.each(['active', 'past_due'] as const)(
    'cancels a %s subscription once, before anything is deleted',
    async (status) => {
      const { app, state, payments } = setup();
      payments.enabled = true;
      subscribe(state, status);
      await app.deleteAccount.execute(as(ana), { confirmEmail: 'ana@example.com' });
      expect(payments.canceled).toEqual(['sub_ana']);
      const event = state.audit.find((e) => e.action === 'account.delete');
      expect(event?.metadata).toEqual({ uploads: 0, subscription: 'canceled' });
    },
  );

  it('deletes nothing when the provider fails, and works on a retry', async () => {
    const { app, state, payments } = setup();
    payments.enabled = true;
    payments.cancelFails = true;
    subscribe(state, 'active');
    await app.createTrip.execute(as(ana), { title: 'Japan', startDate: null });
    await expect(
      app.deleteAccount.execute(as(ana), { confirmEmail: 'ana@example.com' }),
    ).rejects.toThrow(UnavailableError);
    expect([...state.trips.values()].some((t) => t.ownerId === ana.id)).toBe(true);
    expect(state.audit.some((e) => e.action === 'account.delete')).toBe(false);
    await expect(app.exportAccount.execute(as(ana), {})).resolves.toMatchObject({ version: 1 });

    payments.cancelFails = false;
    await expect(
      app.deleteAccount.execute(as(ana), { confirmEmail: 'ana@example.com' }),
    ).resolves.toEqual({ ok: true });
    expect(payments.canceled).toEqual(['sub_ana']);
  });

  it('does not call the provider for a canceled subscription, nor while payments are off', async () => {
    const off = setup();
    subscribe(off.state, 'active');
    await off.app.deleteAccount.execute(as(ana), { confirmEmail: 'ana@example.com' });
    expect(off.payments.canceled).toEqual([]);
    expect(off.state.audit.find((e) => e.action === 'account.delete')?.metadata).toEqual({
      uploads: 0,
      subscription: 'off',
    });

    const done = setup();
    done.payments.enabled = true;
    subscribe(done.state, 'canceled');
    await done.app.deleteAccount.execute(as(ana), { confirmEmail: 'ana@example.com' });
    expect(done.payments.canceled).toEqual([]);
    expect(done.state.audit.find((e) => e.action === 'account.delete')?.metadata).toEqual({
      uploads: 0,
      subscription: 'none',
    });
  });

  it('deletes the account when the provider no longer has the subscription, and records it', async () => {
    const { app, state, payments } = setup();
    payments.enabled = true;
    payments.missing = true;
    subscribe(state, 'active');
    await expect(
      app.deleteAccount.execute(as(ana), { confirmEmail: 'ana@example.com' }),
    ).resolves.toEqual({ ok: true });
    expect(state.audit.find((e) => e.action === 'account.delete')?.metadata).toEqual({
      uploads: 0,
      subscription: 'missing',
    });
    await expect(app.exportAccount.execute(as(ana), {})).rejects.toThrow(NotFoundError);
  });

  it('ignores a later webhook for the deleted account', async () => {
    const { app, state, ports, payments } = setup();
    payments.enabled = true;
    subscribe(state, 'active');
    await app.deleteAccount.execute(as(ana), { confirmEmail: 'ana@example.com' });
    const events = createPaymentEvents(ports);
    await expect(
      events.apply({
        kind: 'subscription',
        userId: ana.id,
        record: {
          plan: 'explorer',
          interval: 'month',
          status: 'canceled',
          startedAt: new Date('2026-11-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
          providerCustomerId: 'cus_ana',
          providerSubscriptionId: 'sub_ana',
        },
      }),
    ).resolves.toBe('unknown-account');
  });
});

describe('trip deletion', () => {
  it('deletes only an archived trip of the owner', async () => {
    const { app } = setup();
    const trip = await app.createTrip.execute(as(ana), { title: 'Japan', startDate: null });
    await expect(app.deleteTrip.execute(as(ana), { id: trip.id })).rejects.toThrow(ValidationError);
    await app.archiveTrip.execute(as(ana), { id: trip.id });
    await expect(app.deleteTrip.execute(as(leo), { id: trip.id })).rejects.toThrow(NotFoundError);
    await expect(app.deleteTrip.execute(as(ana), { id: trip.id })).resolves.toEqual({ ok: true });
    await expect(app.getTrip.execute(as(ana), { id: trip.id })).rejects.toThrow(NotFoundError);
  });
});
