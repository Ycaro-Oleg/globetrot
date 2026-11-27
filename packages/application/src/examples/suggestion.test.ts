import { suggestPlan } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import { createApplication, NotFoundError, type Actor, type UserRecord } from '../index';
import { createFakePorts } from '../testing';
import { createTripFromSuggestionFields } from './suggestion';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'b@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const as = (user: UserRecord): Actor => ({ kind: 'user', userId: user.id });

function setup() {
  const fake = createFakePorts({ users: [ana, bruno], now: new Date('2026-11-27T12:00:00.000Z') });
  return { ...fake, app: createApplication(fake.ports) };
}

const japan = {
  destination: 'japan',
  likes: ['adrenaline' as const, 'food' as const],
  days: 12,
  comfort: 'budget' as const,
};

describe('a trip from the landing’s suggested plan', () => {
  it('copies the plan’s stops, nights, legs and places, in Portuguese for a pt-BR visitor', async () => {
    const { app } = setup();
    const trip = await app.createTripFromSuggestion.execute(as(ana), {
      ...japan,
      currency: 'USD',
      locale: 'pt-BR',
    });
    expect(trip).toMatchObject({ title: 'Japão', currency: 'USD' });
    const plan = suggestPlan(japan)!;
    const { destinations } = await app.listDestinations.execute(as(ana), { tripId: trip.id });
    expect(destinations.map((stop) => [stop.name, stop.nights])).toEqual(
      plan.stops.map((stop) => [stop.stop.namePt, stop.nights]),
    );
    expect(destinations.map((stop) => stop.legMode)).toEqual(
      plan.stops.map((stop) => stop.next?.mode ?? null),
    );
    const tokyo = destinations[0]!;
    expect(tokyo.spots.map((spot) => spot.name)).toContain('Drift na pista de Ebisu (bate-volta)');
    // The drift day trip is in Fukushima, far from Tokyo: no A→B→C route there.
    expect(tokyo.spotRoute).toBe(false);
    await expect(app.getTrip.execute(as(bruno), { id: trip.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('keeps the plan’s estimate as the trip’s guess and the monthly amount as its savings', async () => {
    const { app } = setup();
    const trip = await app.createTripFromSuggestion.execute(as(ana), {
      ...japan,
      currency: 'USD',
      monthly: '300',
    });
    const budget = await app.getBudget.execute(as(ana), { tripId: trip.id });
    const { expenses } = await app.listExpenses.execute(as(ana), { tripId: trip.id });
    const plan = suggestPlan(japan)!;
    const guess = expenses.find((expense) => expense.guess)!;
    expect(guess.status).toBe('estimate');
    expect(guess.original).toEqual({
      amount: `${plan.estimate.middle.amountMinor / 100n}.00`,
      currency: 'USD',
    });
    expect(budget.savings.monthly).toEqual({ amount: '300.00', currency: 'USD' });
  });

  it('reads the USD estimate at the recorded reference rate when the trip is in reais', async () => {
    const { app } = setup();
    const trip = await app.createTripFromSuggestion.execute(as(ana), {
      ...japan,
      currency: 'BRL',
      monthly: '1500',
    });
    expect(trip.currency).toBe('BRL');
    const { expenses } = await app.listExpenses.execute(as(ana), { tripId: trip.id });
    const guess = expenses.find((expense) => expense.guess)!;
    expect(guess.original.currency).toBe('USD');
    expect(guess.inTripCurrency.currency).toBe('BRL');
    expect(Number(guess.inTripCurrency.amount)).toBeGreaterThan(Number(guess.original.amount));
    expect(guess.fx?.source).toMatch(/European Central Bank/);
    expect(guess.fx?.asOf).toBe('2026-11-26');
  });

  it('refuses an unknown destination or currency and replays a retry with the same key', async () => {
    const { app, state } = setup();
    expect(
      createTripFromSuggestionFields.safeParse({ ...japan, destination: 'mars', currency: 'USD' })
        .success,
    ).toBe(false);
    expect(createTripFromSuggestionFields.safeParse({ ...japan, currency: 'XYZ' }).success).toBe(
      false,
    );
    const first = await app.createTripFromSuggestion.execute(as(ana), {
      ...japan,
      currency: 'USD',
      idempotencyKey: 'plan-japan-00001',
    });
    const again = await app.createTripFromSuggestion.execute(as(ana), {
      ...japan,
      currency: 'USD',
      idempotencyKey: 'plan-japan-00001',
    });
    expect(again.id).toBe(first.id);
    expect((await app.listTrips.execute(as(ana), {})).trips).toHaveLength(1);
    const created = state.audit.filter((entry) => entry.action === 'trip.create');
    expect(created).toHaveLength(1);
    expect(created[0]?.metadata).toEqual({ fromSuggestion: 'japan', days: 12 });
  });
});
