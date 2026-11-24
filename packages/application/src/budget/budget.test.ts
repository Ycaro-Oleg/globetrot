import { describe, expect, it } from 'vitest';
import {
  createApplication,
  NotFoundError,
  ValidationError,
  type Actor,
  type UserRecord,
} from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'b@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const as = (user: UserRecord): Actor => ({ kind: 'user', userId: user.id });

const FLIGHTS = {
  description: 'Flights to Tokyo',
  category: 'flights',
  status: 'estimate',
  amount: '1250.00',
  currency: 'USD',
} as const;

async function setup(startDate: string | null = '2027-04-03') {
  const fake = createFakePorts({ users: [ana, bruno], now: new Date('2026-11-07T12:00:00.000Z') });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), { title: 'Japan 2027', startDate });
  return { ...fake, app, trip };
}

async function issues(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
}

describe('expenses', () => {
  it('stores a cost in the trip’s own currency with no conversion', async () => {
    const { app, trip } = await setup();
    const created = await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS });
    expect(created).toMatchObject({
      description: 'Flights to Tokyo',
      category: 'flights',
      status: 'estimate',
      original: { amount: '1250.00', currency: 'USD' },
      inTripCurrency: { amount: '1250.00', currency: 'USD' },
      fx: null,
    });
    expect(await app.listExpenses.execute(as(ana), { tripId: trip.id })).toEqual({
      expenses: [created],
    });
  });

  it('converts a cost in another currency at the rate given, and keeps the rate, its source and its day', async () => {
    const { app, trip } = await setup();
    const created = await app.createExpense.execute(as(ana), {
      tripId: trip.id,
      ...FLIGHTS,
      description: 'Ryokan',
      amount: '150000',
      currency: 'JPY',
      fxRate: '0.0065',
    });
    expect(created.original).toEqual({ amount: '150000', currency: 'JPY' });
    expect(created.inTripCurrency).toEqual({ amount: '975.00', currency: 'USD' });
    expect(created.fx).toEqual({ rate: '0.0065', source: 'manual', asOf: '2026-11-07' });
  });

  it('takes the day of the rate from the request when it is sent', async () => {
    const { app, trip } = await setup();
    const created = await app.createExpense.execute(as(ana), {
      tripId: trip.id,
      ...FLIGHTS,
      amount: '100',
      currency: 'EUR',
      fxRate: '1.08',
      fxAsOf: '2026-10-30',
    });
    expect(created.fx).toMatchObject({ asOf: '2026-10-30' });
    expect(created.inTripCurrency.amount).toBe('108.00');
  });

  it.each([
    ['a foreign cost with no rate', { currency: 'JPY', amount: '1000' }, 'fxRate'],
    ['a rate for a cost in the trip’s own currency', { fxRate: '1.2' }, 'fxRate'],
    ['more decimals than the currency has', { amount: '12.345' }, 'amount'],
    [
      'decimals in a currency without any',
      { currency: 'JPY', amount: '100.5', fxRate: '0.0065' },
      'amount',
    ],
    ['a zero amount', { amount: '0.00' }, 'amount'],
    ['a negative amount', { amount: '-5' }, 'amount'],
    ['text for an amount', { amount: 'twelve' }, 'amount'],
    ['a zero rate', { currency: 'JPY', amount: '100', fxRate: '0' }, 'fxRate'],
    [
      'an amount worth less than the smallest unit after converting',
      { currency: 'JPY', amount: '1', fxRate: '0.001' },
      'amount',
    ],
    ['an unknown currency', { currency: 'XXX' }, 'currency'],
    ['an empty description', { description: '   ' }, 'description'],
    ['an unknown category', { category: 'fun' }, 'category'],
    ['an unknown status', { status: 'maybe' }, 'status'],
  ])('rejects %s and stores nothing', async (_name, change, field) => {
    const { app, trip, state } = await setup();
    const found = await issues(
      app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS, ...change } as never),
    );
    expect(found.map((issue) => issue.field)).toContain(field);
    expect(state.expenses.size).toBe(0);
  });

  it('replaces a cost, repricing it', async () => {
    const { app, trip } = await setup();
    const created = await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS });
    const updated = await app.updateExpense.execute(as(ana), {
      tripId: trip.id,
      expenseId: created.id,
      ...FLIGHTS,
      status: 'paid',
      amount: '90000',
      currency: 'JPY',
      fxRate: '0.0066',
    });
    expect(updated).toMatchObject({
      id: created.id,
      status: 'paid',
      inTripCurrency: { amount: '594.00' },
    });
    expect(updated.fx).toMatchObject({ rate: '0.0066' });
    // and back to the trip's currency: the conversion goes away
    const back = await app.updateExpense.execute(as(ana), {
      tripId: trip.id,
      expenseId: created.id,
      ...FLIGHTS,
    });
    expect(back.fx).toBeNull();
  });

  it('removes a cost', async () => {
    const { app, trip } = await setup();
    const created = await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS });
    await app.deleteExpense.execute(as(ana), { tripId: trip.id, expenseId: created.id });
    expect((await app.listExpenses.execute(as(ana), { tripId: trip.id })).expenses).toEqual([]);
  });

  it('is "not found" for someone else’s trip, and for a cost of another trip', async () => {
    const { app, trip } = await setup();
    const created = await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS });
    const other = await app.createTrip.execute(as(ana), { title: 'Peru' });
    for (const run of [
      () => app.createExpense.execute(as(bruno), { tripId: trip.id, ...FLIGHTS }),
      () => app.listExpenses.execute(as(bruno), { tripId: trip.id }),
      () => app.getBudget.execute(as(bruno), { tripId: trip.id }),
      () => app.updateSavings.execute(as(bruno), { tripId: trip.id, saved: '1' }),
      () => app.deleteExpense.execute(as(bruno), { tripId: trip.id, expenseId: created.id }),
      // The cost exists, but not in that trip.
      () =>
        app.updateExpense.execute(as(ana), { tripId: other.id, expenseId: created.id, ...FLIGHTS }),
      () => app.deleteExpense.execute(as(ana), { tripId: other.id, expenseId: created.id }),
    ]) {
      await expect(run()).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  it('audits the category and status of a cost and never its amount or description', async () => {
    const { app, trip, state } = await setup();
    await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS });
    const event = state.audit.at(-1);
    expect(event).toMatchObject({
      action: 'expense.create',
      metadata: { category: 'flights', status: 'estimate' },
    });
    const text = JSON.stringify(event);
    expect(text).not.toContain('1250');
    expect(text).not.toContain('Tokyo');
  });

  it('keeps nothing when the audit write fails', async () => {
    const { app, trip, state, faults } = await setup();
    faults.auditFails = true;
    await expect(
      app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS }),
    ).rejects.toThrow();
    expect(state.expenses.size).toBe(0);
  });
});

describe('the budget and the savings answer', () => {
  it('is empty before any cost: nothing to save for', async () => {
    const { app, trip } = await setup();
    const budget = await app.getBudget.execute(as(ana), { tripId: trip.id });
    expect(budget.total).toEqual({ amount: '0.00', currency: 'USD' });
    expect(budget.savings.status).toBe('no-costs');
    expect(budget.byCategory).toHaveLength(12);
    expect(budget.byStatus.map((entry) => entry.status)).toEqual([
      'estimate',
      'confirmed',
      'paid',
      'unknown',
    ]);
  });

  it('adds up in the trip’s currency by category and by status, converted costs included', async () => {
    const { app, trip } = await setup();
    await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS });
    await app.createExpense.execute(as(ana), {
      tripId: trip.id,
      ...FLIGHTS,
      category: 'stay',
      status: 'paid',
      description: 'Ryokan',
      amount: '150000',
      currency: 'JPY',
      fxRate: '0.0065',
    });
    const budget = await app.getBudget.execute(as(ana), { tripId: trip.id });
    expect(budget.total).toEqual({ amount: '2225.00', currency: 'USD' });
    expect(budget.byCategory.find((entry) => entry.category === 'flights')?.amount.amount).toBe(
      '1250.00',
    );
    expect(budget.byCategory.find((entry) => entry.category === 'stay')?.amount.amount).toBe(
      '975.00',
    );
    expect(budget.byStatus.find((entry) => entry.status === 'paid')?.amount.amount).toBe('975.00');
  });

  it('answers when the goal is reached at the monthly amount, and what is needed to leave on time', async () => {
    const { app, trip } = await setup('2027-04-03');
    await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS, amount: '2000.00' });
    const budget = await app.updateSavings.execute(as(ana), {
      tripId: trip.id,
      saved: '500',
      monthly: '300',
    });
    expect(budget.savings).toMatchObject({
      status: 'saving',
      saved: { amount: '500.00' },
      monthly: { amount: '300.00' },
      left: { amount: '1500.00' },
      progressBasisPoints: 2500,
      monthsNeeded: 5,
      readyMonth: '2027-04',
      departure: '2027-04-03',
      monthsUntilDeparture: 4,
      onTime: false,
    });
    expect(budget.savings.monthlyNeeded?.currency).toBe('USD');
    const faster = await app.updateSavings.execute(as(ana), { tripId: trip.id, monthly: '400' });
    expect(faster.savings).toMatchObject({
      monthsNeeded: 4,
      onTime: true,
      saved: { amount: '500.00' },
    });
  });

  it('says so when everything is saved', async () => {
    const { app, trip } = await setup();
    await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS });
    const budget = await app.updateSavings.execute(as(ana), { tripId: trip.id, saved: '5000' });
    expect(budget.savings).toMatchObject({
      status: 'fully-saved',
      progressBasisPoints: 10000,
      left: { amount: '0.00' },
    });
  });

  it('keeps a trip ceiling and says how much slack is left, or how far over it the costs are', async () => {
    const { app, trip } = await setup();
    await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS, amount: '2000.00' });
    const none = await app.getBudget.execute(as(ana), { tripId: trip.id });
    expect(none.savings.ceiling).toBeNull();
    expect(none.savings.ceilingSlack).toBeNull();
    const under = await app.updateSavings.execute(as(ana), { tripId: trip.id, ceiling: '2500' });
    expect(under.savings.ceiling).toEqual({ amount: '2500.00', currency: 'USD' });
    expect(under.savings.ceilingSlack).toEqual({ amount: '500.00', currency: 'USD' });
    const over = await app.updateSavings.execute(as(ana), { tripId: trip.id, ceiling: '1800' });
    expect(over.savings.ceilingSlack).toEqual({ amount: '-200.00', currency: 'USD' });
    // Changing another field leaves the ceiling alone; null clears it.
    const kept = await app.updateSavings.execute(as(ana), { tripId: trip.id, monthly: '100' });
    expect(kept.savings.ceiling?.amount).toBe('1800.00');
    const cleared = await app.updateSavings.execute(as(ana), { tripId: trip.id, ceiling: null });
    expect(cleared.savings.ceiling).toBeNull();
  });

  it('works with no start date (no departure to be on time for)', async () => {
    const { app, trip } = await setup(null);
    await app.createExpense.execute(as(ana), { tripId: trip.id, ...FLIGHTS });
    const budget = await app.updateSavings.execute(as(ana), { tripId: trip.id, monthly: '250' });
    expect(budget.savings).toMatchObject({
      departure: null,
      onTime: null,
      monthsUntilDeparture: null,
      monthsNeeded: 5,
    });
  });

  it.each([
    ['nothing to change', {}],
    ['a negative amount', { saved: '-1' }],
    ['too many decimals', { monthly: '10.999' }],
    ['text', { saved: 'lots' }],
    ['a negative ceiling', { ceiling: '-5' }],
  ])('rejects savings with %s', async (_name, body) => {
    const { app, trip } = await setup();
    await expect(
      app.updateSavings.execute(as(ana), { tripId: trip.id, ...body } as never),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('the trip’s currency is locked once there is money in it', () => {
  it('can change while the trip has no costs and no savings', async () => {
    const { app, trip } = await setup();
    expect((await app.updateTrip.execute(as(ana), { id: trip.id, currency: 'EUR' })).currency).toBe(
      'EUR',
    );
  });

  it.each([
    [
      'a cost',
      async (app: ReturnType<typeof createApplication>, id: string) =>
        void (await app.createExpense.execute(as(ana), { tripId: id, ...FLIGHTS })),
    ],
    [
      'savings',
      async (app: ReturnType<typeof createApplication>, id: string) =>
        void (await app.updateSavings.execute(as(ana), { tripId: id, saved: '10' })),
    ],
  ])('refuses to change with %s in it, with a stable code', async (_name, addMoney) => {
    const { app, trip } = await setup();
    await addMoney(app, trip.id);
    const found = await issues(app.updateTrip.execute(as(ana), { id: trip.id, currency: 'EUR' }));
    expect(found).toContainEqual(
      expect.objectContaining({ field: 'currency', code: 'currency_locked' }),
    );
    // the same currency, and other fields, are still fine
    expect(
      (await app.updateTrip.execute(as(ana), { id: trip.id, currency: 'USD', title: 'Renamed' }))
        .title,
    ).toBe('Renamed');
  });
});
