import { describe, expect, it } from 'vitest';
import { createApplication, type Actor, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });

async function setup(currency = 'BRL') {
  const fake = createFakePorts({ users: [ana], now: new Date('2026-11-27T12:00:00.000Z') });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), { title: 'Japão', startDate: null, currency });
  await app.createExpense.execute(as(ana), {
    tripId: trip.id,
    description: 'Tudo',
    category: 'other',
    status: 'estimate',
    amount: currency === 'BRL' ? '6000' : '1000',
    currency,
  });
  await app.updateSavings.execute(as(ana), {
    tripId: trip.id,
    saved: '0',
    monthly: currency === 'BRL' ? '1000' : '100',
  });
  return { ...fake, app, trip };
}

describe('miles towards a trip (ADR-0030)', () => {
  it('keeps balances, puts some towards the trip and moves the ready month earlier', async () => {
    const { app, trip } = await setup();
    await app.setMiles.execute(as(ana), { program: 'smiles', balance: 100_000 });
    const before = await app.getMiles.execute(as(ana), { tripId: trip.id });
    expect(before.programs).toEqual([
      expect.objectContaining({ program: 'smiles', balance: 100_000, onTrip: 0 }),
    ]);
    expect(before.applied).toBeNull();
    await app.setTripMiles.execute(as(ana), { tripId: trip.id, program: 'smiles', miles: 60_000 });
    const after = await app.getMiles.execute(as(ana), { tripId: trip.id });
    // 60 000 Smiles miles ≈ R$ 960–1.320, middle R$ 1.140: R$ 4.860 left at R$ 1.000 a month = 5 months.
    expect(after.applied?.middle.amount).toBe('1140.00');
    expect(after.withMiles).toEqual({
      left: { amount: '4860.00', currency: 'BRL' },
      readyMonth: '2027-04',
    });
    expect(after.sources.length).toBeGreaterThan(0);
  });

  it('never puts more miles than the balance, and removing a balance removes it from trips', async () => {
    const { app, trip } = await setup();
    await app.setMiles.execute(as(ana), { program: 'azul', balance: 10_000 });
    await expect(
      app.setTripMiles.execute(as(ana), { tripId: trip.id, program: 'azul', miles: 20_000 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await app.setTripMiles.execute(as(ana), { tripId: trip.id, program: 'azul', miles: 10_000 });
    await app.setMiles.execute(as(ana), { program: 'azul', balance: 0 });
    const result = await app.getMiles.execute(as(ana), { tripId: trip.id });
    expect(result.programs).toEqual([]);
    expect(result.applied).toBeNull();
  });

  it('converts the value into the trip’s currency at the reference rates', async () => {
    const { app, trip } = await setup('USD');
    await app.setMiles.execute(as(ana), { program: 'livelo', balance: 50_000 });
    await app.setTripMiles.execute(as(ana), { tripId: trip.id, program: 'livelo', miles: 50_000 });
    const result = await app.getMiles.execute(as(ana), { tripId: trip.id });
    expect(result.applied?.middle.currency).toBe('USD');
    expect(Number(result.applied?.middle.amount)).toBeGreaterThan(200);
  });
});
