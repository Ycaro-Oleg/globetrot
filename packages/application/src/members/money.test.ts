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
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });

async function setup() {
  const fake = createFakePorts({
    users: [ana, bruno, carla],
    now: new Date('2026-11-27T12:00:00.000Z'),
  });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), {
    title: 'Lisboa',
    startDate: null,
    currency: 'BRL',
  });
  const { token } = await app.createInvite.execute(as(ana), { tripId: trip.id });
  await app.acceptInvite.execute(as(bruno), { token });
  const cost = (amount: string, paidBy: string | null, status: 'paid' | 'estimate' = 'paid') =>
    app.createExpense.execute(as(ana), {
      tripId: trip.id,
      description: 'Custo',
      category: 'stay',
      status,
      amount,
      currency: 'BRL',
      paidBy,
    });
  return { ...fake, app, trip, cost };
}

describe('money on a trip planned together (ADR-0025)', () => {
  it('splits the total equally, tracks each person’s savings and when they will have their part', async () => {
    const { app, trip, cost } = await setup();
    await cost('3000.00', null, 'estimate');
    await app.updateMyMoney.execute(as(bruno), { tripId: trip.id, saved: '500', monthly: '250' });
    const money = await app.getGroupMoney.execute(as(bruno), { tripId: trip.id });
    expect(money.custom).toBe(false);
    expect(money.people.map((p) => [p.name, p.share.amount, p.saved.amount, p.you])).toEqual([
      ['Ana', '1500.00', '0.00', false],
      ['Bruno', '1500.00', '500.00', true],
    ]);
    // 1000 left at 250 a month: four months from November.
    expect(money.people[1]?.readyMonth).toBe('2027-03');
    expect(money.people[0]?.readyMonth).toBeNull();
    expect(money.group).toMatchObject({
      total: { amount: '3000.00' },
      left: { amount: '2500.00' },
    });
  });

  it('settles the paid costs: who pays whom', async () => {
    const { app, trip, cost } = await setup();
    await cost('900.00', ana.id);
    await cost('100.00', bruno.id);
    await cost('50.00', null);
    const { settlement } = await app.getGroupMoney.execute(as(ana), { tripId: trip.id });
    expect(settlement.transfers).toEqual([
      {
        from: bruno.id,
        to: ana.id,
        fromName: 'Bruno',
        toName: 'Ana',
        amount: { amount: '400.00', currency: 'BRL' },
      },
    ]);
    expect(settlement.unassigned.amount).toBe('50.00');
  });

  it('takes custom parts from the owner only, adding up to the whole trip, and only people on the trip pay', async () => {
    const { app, trip, cost } = await setup();
    await cost('1000.00', null, 'estimate');
    await expect(
      app.setShares.execute(as(bruno), { tripId: trip.id, shares: null }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      app.setShares.execute(as(ana), {
        tripId: trip.id,
        shares: [{ userId: ana.id, shareBp: 6000 }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await app.setShares.execute(as(ana), {
      tripId: trip.id,
      shares: [
        { userId: ana.id, shareBp: 7000 },
        { userId: bruno.id, shareBp: 3000 },
      ],
    });
    const money = await app.getGroupMoney.execute(as(ana), { tripId: trip.id });
    expect(money.custom).toBe(true);
    expect(money.people.map((p) => p.share.amount)).toEqual(['700.00', '300.00']);
    await expect(cost('10.00', carla.id)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(app.getGroupMoney.execute(as(carla), { tripId: trip.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
