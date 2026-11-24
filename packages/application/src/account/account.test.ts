import { describe, expect, it } from 'vitest';
import {
  createApplication,
  NotFoundError,
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
    expect(event?.metadata).toEqual({ uploads: 0 });
    expect(JSON.stringify(event)).not.toContain('example.com');
    await expect(app.exportAccount.execute(as(ana), {})).rejects.toThrow(NotFoundError);
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
