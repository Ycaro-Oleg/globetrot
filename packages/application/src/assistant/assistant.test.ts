import { PIP_DAILY_CAP, TRIAL_TERMS } from '@globetrot/domain';
import { describe, expect, it } from 'vitest';
import {
  createApplication,
  NotFoundError,
  PlanLimitError,
  RateLimitedError,
  UnavailableError,
  ValidationError,
  type Actor,
  type UserRecord,
} from '../index';
import { createFakePorts } from '../testing';
import { systemPrompt } from './prompt';

const ana: UserRecord = {
  id: 'u-ana',
  email: 'ana@example.com',
  name: 'Ana Secret',
  emailVerified: true,
};
const leo: UserRecord = { id: 'u-leo', email: 'leo@example.com', name: 'Leo', emailVerified: true };
const as = (who: UserRecord): Actor => ({ kind: 'user', userId: who.id });
const stop = (name: string, nights: number, extra = {}) => ({
  placeKey: `t:${name}`,
  name,
  countryCode: 'JP',
  latitude: 35,
  longitude: 135,
  nights,
  ...extra,
});

async function setup() {
  const fake = createFakePorts({ users: [ana, leo] });
  const app = createApplication(fake.ports);
  const trip = await app.createTrip.execute(as(ana), { title: 'Japan', startDate: null });
  await app.replaceDestinations.execute(as(ana), {
    tripId: trip.id,
    destinations: [stop('Tokyo', 3), stop('Kyoto', 2)],
  });
  const answer = (value: unknown) => {
    fake.ai.next = JSON.stringify(value);
  };
  const ask = (request = 'Make it better') =>
    app.askPip.execute(as(ana), { tripId: trip.id, request });
  return { ...fake, app, trip, answer, ask };
}

describe('asking Pip', () => {
  it('sends the plan but never the person’s name or email', async () => {
    const { ai, ask } = await setup();
    await ask('Add a day in Nara');
    const sent = ai.requests[0]!;
    expect(sent.user).toContain('Tokyo');
    expect(sent.user).toContain('"id":"s1"');
    expect(sent.user).not.toContain('Ana Secret');
    expect(sent.user).not.toContain('ana@example.com');
    expect(sent.system).toContain('never live prices');
  });

  it('keeps only valid changes, with stop references turned into ids', async () => {
    const { answer, ask, app, trip } = await setup();
    answer({
      summary: 'A calmer pace.',
      changes: [
        { kind: 'setNights', stopId: 's2', nights: 4, reason: 'More time in Kyoto' },
        { kind: 'setNights', stopId: 's9', nights: 4 },
        { kind: 'teleport', to: 'Mars' },
        { kind: 'addExpense', category: 'food', description: 'Street food', amount: 'lots' },
        { kind: 'addExpense', category: 'food', description: 'Street food', amount: '120.00' },
        {
          kind: 'addChecklistItem',
          group: 'documents',
          label: 'Check entry rules on the official site',
        },
      ],
    });
    const proposal = await ask();
    expect(proposal.summary).toBe('A calmer pace.');
    expect(proposal.changes.map((c) => c.kind)).toEqual([
      'setNights',
      'addExpense',
      'addChecklistItem',
    ]);
    const route = await app.listDestinations.execute(as(ana), { tripId: trip.id });
    expect(proposal.changes[0]).toMatchObject({ stopId: route.destinations[1]!.id });
    // Nothing changed yet.
    expect(route.destinations[1]!.nights).toBe(2);
  });

  it('survives an answer that is not JSON', async () => {
    const { ask, ai } = await setup();
    ai.next = 'Sorry, I cannot';
    expect((await ask()).changes).toEqual([]);
  });

  it('says when Pip is not available (costing no credit), and caps requests a day on any plan', async () => {
    const { ask, ai, state, ports } = await setup();
    ai.next = null;
    await expect(ask()).rejects.toThrow(UnavailableError);
    expect(state.aiUsage).toHaveLength(0);
    ai.next = '{"summary":"","changes":[]}';
    await ports.billing.findAccount(ana.id);
    state.subscriptions.set(ana.id, {
      plan: 'voyager',
      interval: 'month',
      status: 'active',
      startedAt: new Date('2026-11-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
      providerCustomerId: null,
      providerSubscriptionId: null,
    });
    for (let n = 0; n < PIP_DAILY_CAP; n++) await ask();
    await expect(ask()).rejects.toThrow(RateLimitedError);
  });

  it('spends trial credits first, then bought ones, then stops', async () => {
    const { ask, state } = await setup();
    for (let n = 0; n < TRIAL_TERMS.credits; n++) await ask();
    await expect(ask()).rejects.toMatchObject({ code: 'OUT_OF_CREDITS' });
    state.credits.push({ userId: ana.id, delta: 2, reason: 'top-up', ref: 'pay_1' });
    await ask();
    await ask();
    expect(state.credits.filter((line) => line.reason === 'pip')).toHaveLength(2);
    await expect(ask()).rejects.toThrow(PlanLimitError);
  });

  it('only works on one’s own trip', async () => {
    const { app, trip } = await setup();
    await expect(app.askPip.execute(as(leo), { tripId: trip.id, request: 'hi' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('asks the model to answer in the person’s language', () => {
    expect(systemPrompt('pt-BR')).toContain('Brazilian Portuguese');
    expect(systemPrompt('en')).toContain('in English');
  });
});

describe('applying, discarding and undoing', () => {
  it('applies only the chosen changes, then undo puts the trip back', async () => {
    const { answer, ask, app, trip } = await setup();
    answer({
      summary: 'Add Nara and pack.',
      changes: [
        {
          kind: 'addStop',
          name: 'Nara',
          countryCode: 'JP',
          latitude: 34.68,
          longitude: 135.8,
          nights: 1,
          afterStopId: 's2',
          reason: 'Day trip',
        },
        { kind: 'setNights', stopId: 's1', nights: 4 },
        { kind: 'addPlace', stopId: 's2', name: 'Fushimi Inari', minutes: 120 },
        { kind: 'addChecklistItem', group: 'packing', label: 'Rain jacket' },
        { kind: 'addExpense', category: 'food', description: 'Meals (estimate)', amount: '300' },
        { kind: 'setMonthly', amount: '250' },
      ],
    });
    const proposal = await ask();
    const applied = await app.applyProposal.execute(as(ana), {
      proposalId: proposal.id,
      include: [0, 2, 3, 4, 5],
    });
    expect(applied).toMatchObject({ status: 'applied', applied: [0, 2, 3, 4, 5], undoable: true });

    const route = (await app.listDestinations.execute(as(ana), { tripId: trip.id })).destinations;
    expect(route.map((s) => [s.name, s.nights])).toEqual([
      ['Tokyo', 3],
      ['Kyoto', 2],
      ['Nara', 1],
    ]);
    const plan = await app.listDayPlaces.execute(as(ana), { tripId: trip.id });
    expect(plan.places.map((p) => p.name)).toEqual(['Fushimi Inari']);
    const expenses = await app.listExpenses.execute(as(ana), { tripId: trip.id });
    expect(expenses.expenses).toMatchObject([
      { status: 'estimate', description: 'Meals (estimate)' },
    ]);
    const budget = await app.getBudget.execute(as(ana), { tripId: trip.id });
    expect(budget.savings.monthly.amount).toBe('250.00');

    await expect(
      app.applyProposal.execute(as(ana), { proposalId: proposal.id, include: [1] }),
    ).rejects.toThrow(ValidationError);

    const undone = await app.undoProposal.execute(as(ana), { proposalId: proposal.id });
    expect(undone.status).toBe('undone');
    const back = (await app.listDestinations.execute(as(ana), { tripId: trip.id })).destinations;
    expect(back.map((s) => s.name)).toEqual(['Tokyo', 'Kyoto']);
    expect((await app.listDayPlaces.execute(as(ana), { tripId: trip.id })).places).toEqual([]);
    expect((await app.listExpenses.execute(as(ana), { tripId: trip.id })).expenses).toEqual([]);
    expect((await app.getBudget.execute(as(ana), { tripId: trip.id })).savings.monthly.amount).toBe(
      '0.00',
    );
    await expect(app.undoProposal.execute(as(ana), { proposalId: proposal.id })).rejects.toThrow(
      ValidationError,
    );
  });

  it('discards, and nobody else can touch a proposal', async () => {
    const { answer, ask, app } = await setup();
    answer({ summary: 'x', changes: [{ kind: 'setNights', stopId: 's1', nights: 5 }] });
    const proposal = await ask();
    await expect(app.discardProposal.execute(as(leo), { proposalId: proposal.id })).rejects.toThrow(
      NotFoundError,
    );
    expect((await app.discardProposal.execute(as(ana), { proposalId: proposal.id })).status).toBe(
      'discarded',
    );
    await expect(
      app.applyProposal.execute(as(ana), { proposalId: proposal.id, include: [0] }),
    ).rejects.toThrow(ValidationError);
  });

  it('lists a trip’s proposals, newest first', async () => {
    const { ask, app, trip } = await setup();
    await ask('first');
    await ask('second');
    const list = await app.listProposals.execute(as(ana), { tripId: trip.id });
    expect(list.proposals.map((p) => p.request)).toEqual(['second', 'first']);
  });
});

describe('Pip filling a pin', () => {
  // Kyoto sits at 35, 135 in this trip; the places the map offers are near it, but one is 300 km away.
  const places = [
    { name: 'Ryokan Gion', kind: 'hotel', latitude: 35.004, longitude: 135.005 },
    { name: 'Nishiki Market', kind: 'marketplace', latitude: 35.005, longitude: 135.006 },
    { name: 'Fushimi Inari', kind: 'shrine', latitude: 34.967, longitude: 135.003 },
    { name: 'Far away tower', kind: 'attraction', latitude: 37.7, longitude: 135.0 },
  ];
  const askToFill = async (env: Awaited<ReturnType<typeof setup>>) => {
    const route = await env.app.listDestinations.execute(as(ana), { tripId: env.trip.id });
    const kyoto = route.destinations[1]!;
    const proposal = await env.app.askPip.execute(as(ana), {
      tripId: env.trip.id,
      request: 'Fill Kyoto',
      spotCandidates: { placeKey: kyoto.placeKey, places },
    });
    return { proposal, kyoto };
  };

  it('offers only real places near the stop, by candidate, and nothing but spots', async () => {
    const env = await setup();
    env.answer({
      summary: 'A night in Gion, a market and the gates.',
      changes: [
        { kind: 'addSpot', candidate: 'c1', reason: 'Sleep near the old town' },
        { kind: 'addSpot', candidate: 'c3', reason: 'Go early' },
        { kind: 'addSpot', candidate: 'c3', reason: 'Twice' },
        { kind: 'addSpot', candidate: 'c9', reason: 'Not offered' },
        { kind: 'addSpot', name: 'Invented Café', latitude: 35, longitude: 135 },
        { kind: 'setNights', stopId: 's1', nights: 9 },
      ],
    });
    const { proposal, kyoto } = await askToFill(env);
    expect(proposal.changes).toEqual([
      {
        kind: 'addSpot',
        stopId: kyoto.id,
        name: 'Ryokan Gion',
        spotKind: 'stay',
        latitude: 35.004,
        longitude: 135.005,
        reason: 'Sleep near the old town',
      },
      {
        kind: 'addSpot',
        stopId: kyoto.id,
        name: 'Fushimi Inari',
        spotKind: 'sight',
        latitude: 34.967,
        longitude: 135.003,
        reason: 'Go early',
      },
    ]);
    // The model saw the near places by id, and never the far one.
    const sent = env.ai.requests[0]!.user;
    expect(sent).toContain('"id":"c1"');
    expect(sent).toContain('Nishiki Market');
    expect(sent).not.toContain('Far away tower');
    expect(env.ai.requests[0]!.system).toContain('Never invent a place or an id');
  });

  it('adds the chosen spots with their kind and place, and Undo takes them back', async () => {
    const env = await setup();
    env.answer({
      summary: 'x',
      changes: [
        { kind: 'addSpot', candidate: 'c1' },
        { kind: 'addSpot', candidate: 'c2' },
      ],
    });
    const { proposal, kyoto } = await askToFill(env);
    await env.app.applyProposal.execute(as(ana), { proposalId: proposal.id, include: [0] });
    const after = await env.app.listDestinations.execute(as(ana), { tripId: env.trip.id });
    expect(after.destinations.find((d) => d.id === kyoto.id)!.spots).toEqual([
      { name: 'Ryokan Gion', kind: 'stay', latitude: 35.004, longitude: 135.005, done: false },
    ]);
    await env.app.undoProposal.execute(as(ana), { proposalId: proposal.id });
    const undone = await env.app.listDestinations.execute(as(ana), { tripId: env.trip.id });
    expect(undone.destinations.find((d) => d.id === kyoto.id)!.spots).toEqual([]);
  });

  it('answers "not found" for a stop that is not on this trip', async () => {
    const env = await setup();
    await expect(
      env.app.askPip.execute(as(ana), {
        tripId: env.trip.id,
        request: 'Fill it',
        spotCandidates: { placeKey: 't:Osaka', places },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
