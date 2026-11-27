import {
  canDecide,
  CHECKLIST_GROUPS,
  fromDecimal,
  MoneyError,
  PIP_CHANGES_MAX,
  PIP_DAILY_CAP,
  creditBalance,
  distanceKm,
  PROPOSAL_STATUSES,
  spotKindOf,
  STOP_SPOTS_MAX,
  type ProposalStatus,
  type SpotKind,
} from '@globetrot/domain';
import { z } from 'zod';
import type { Actor } from '../actor';
import { budgetOf } from '../budget/operations';
import { CHECKLIST_MAX_ITEMS } from '../checklists/schemas';
import { DAY_PLACES_MAX } from '../days/schemas';
import { loadRights } from '../billing/rules';
import {
  NotFoundError,
  PlanLimitError,
  RateLimitedError,
  UnavailableError,
  ValidationError,
} from '../errors';
import { defineOperation } from '../operation';
import type {
  DestinationRecord,
  NewDestination,
  Ports,
  ProposalRecord,
  Transaction,
  TripRecord,
} from '../ports';
import { loadTripFor } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';
import { systemPrompt, userPrompt, type PipContext } from './prompt';
import {
  applyProposalFields,
  askPipFields,
  PIP_SPOT_CANDIDATE_RADIUS_KM,
  pipChangeSchema,
  proposalListSchema,
  proposalSchema,
  type PipChange,
  type ProposalView,
} from './schemas';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OUTPUT_TOKENS = 1800;

/** What applying created and what it replaced, so "Undo" can put the trip back. */
interface UndoData {
  readonly route: DestinationRecord[] | null;
  readonly monthlyMinor: string | null;
  readonly placeIds: string[];
  readonly checklistIds: string[];
  readonly expenseIds: string[];
}

const isStatus = (value: string): value is ProposalStatus =>
  (PROPOSAL_STATUSES as readonly string[]).includes(value);

function toView(record: ProposalRecord, currency: string, now: Date): ProposalView {
  const status = isStatus(record.status) ? record.status : 'discarded';
  return {
    id: record.id,
    tripId: record.tripId,
    request: record.request,
    summary: record.summary,
    currency,
    changes: record.changes.flatMap((change) => {
      const parsed = pipChangeSchema.safeParse(change);
      return parsed.success ? [parsed.data] : [];
    }),
    status,
    applied: record.applied,
    undoable: canDecide({ status, decidedAt: record.decidedAt }, 'undo', now),
    createdAt: record.createdAt.toISOString(),
    decidedAt: record.decidedAt?.toISOString() ?? null,
  };
}

const minor = (amount: string, currency: string): bigint | null => {
  try {
    const value = fromDecimal(amount, currency);
    return value.amountMinor > 0n ? value.amountMinor : null;
  } catch (error) {
    if (error instanceof MoneyError) return null;
    throw error;
  }
};

/** What the model sees of the trip, with stops named "s1", "s2"… instead of their ids. */
async function contextFor(
  deps: Pick<Ports, 'destinations' | 'dayPlaces' | 'checklist' | 'expenses' | 'savings'>,
  trip: TripRecord,
  now: Date,
): Promise<{ context: PipContext; refs: Map<string, string>; stops: DestinationRecord[] }> {
  const [stops, places, checklist, expenses, savings] = await Promise.all([
    deps.destinations.listByTrip(trip.id),
    deps.dayPlaces.listByTrip(trip.id),
    deps.checklist.listByTrip(trip.id),
    deps.expenses.listByTrip(trip.id),
    deps.savings.find(trip.id),
  ]);
  const refs = new Map(stops.map((stop, index) => [`s${index + 1}`, stop.id]));
  const budget = budgetOf(trip, expenses, savings, now);
  return {
    refs,
    stops,
    context: {
      title: trip.title,
      currency: trip.currency,
      startDate: trip.startDate,
      stops: stops.map((stop, index) => ({
        id: `s${index + 1}`,
        name: stop.name,
        countryCode: stop.countryCode,
        nights: stop.nights,
        places: [
          ...stop.spots.map((spot) => spot.name),
          ...places.filter((place) => place.destinationId === stop.id).map((place) => place.name),
        ].slice(0, 30),
      })),
      checklist: Object.fromEntries(
        CHECKLIST_GROUPS.map((group) => [
          group,
          checklist.filter((item) => item.group === group).map((item) => item.label),
        ]),
      ),
      costs: {
        total: budget.total.amount,
        byCategory: Object.fromEntries(
          budget.byCategory
            .filter((entry) => !/^0(\.0+)?$/.test(entry.amount.amount))
            .map((entry) => [entry.category, entry.amount.amount]),
        ),
      },
      savings: { saved: budget.savings.saved.amount, monthly: budget.savings.monthly.amount },
    },
  };
}

/**
 * Keeps what the model answered only when it is a valid change for this trip: stop references become stop ids,
 * money must parse in the trip's currency. Everything else is dropped silently.
 */
export function validChanges(
  raw: unknown,
  refs: Map<string, string>,
  currency: string,
  candidates: ReadonlyMap<string, SpotCandidate> = new Map(),
): PipChange[] {
  if (!Array.isArray(raw)) return [];
  const out: PipChange[] = [];
  const picked = new Set<string>();
  for (const item of raw.slice(0, PIP_CHANGES_MAX * 2)) {
    // A spot is only ever one of the real places the map offered: the model names a candidate ("c3") and the
    // server fills in the name, the kind and the place. Anything else for a spot is dropped.
    if (isRecord(item) && item.kind === 'addSpot') {
      const ref = typeof item.candidate === 'string' ? item.candidate : '';
      const candidate = candidates.get(ref);
      if (!candidate || picked.has(ref)) continue;
      picked.add(ref);
      const spot = pipChangeSchema.safeParse({
        kind: 'addSpot',
        stopId: candidate.stopId,
        name: candidate.name,
        spotKind: candidate.spotKind,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        reason: typeof item.reason === 'string' ? item.reason : '',
      });
      if (spot.success) out.push(spot.data);
      if (out.length >= PIP_CHANGES_MAX) break;
      continue;
    }
    const parsed = pipChangeSchema.safeParse(item);
    if (!parsed.success) continue;
    const change = parsed.data;
    const id = (ref: string | null) => (ref === null ? null : (refs.get(ref) ?? undefined));
    if (change.kind === 'removeStop' || change.kind === 'setNights') {
      const stopId = id(change.stopId);
      if (!stopId) continue;
      out.push({ ...change, stopId });
    } else if (change.kind === 'addStop') {
      const after = id(change.afterStopId);
      if (after === undefined) continue;
      out.push({ ...change, afterStopId: after });
    } else if (change.kind === 'addPlace') {
      const stopId = id(change.stopId);
      if (stopId === undefined) continue;
      out.push({ ...change, stopId });
    } else if (change.kind === 'reorder') {
      const order = change.order.map((ref) => refs.get(ref));
      if (order.some((stopId) => !stopId) || new Set(order).size !== order.length) continue;
      out.push({ ...change, order: order as string[] });
    } else if (change.kind === 'addExpense' || change.kind === 'setMonthly') {
      if (minor(change.amount, currency) === null) continue;
      out.push(change);
    } else {
      out.push(change);
    }
    if (out.length >= PIP_CHANGES_MAX) break;
  }
  return out;
}

/** A real place near a stop that the person's map offered, as Pip may pick it. */
export interface SpotCandidate {
  readonly stopId: string;
  readonly name: string;
  readonly spotKind: SpotKind;
  readonly latitude: number;
  readonly longitude: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

async function loadOwnProposal(
  reader: Pick<Ports['assistant'], 'findProposal'>,
  actor: Actor,
  id: string,
): Promise<ProposalRecord> {
  const proposal = await reader.findProposal(id);
  if (!proposal || proposal.ownerId !== actor.userId) throw new NotFoundError();
  return proposal;
}

function refuse(code: string, message: string): never {
  throw new ValidationError([{ field: 'id', code, message }]);
}

const asNew = (stop: DestinationRecord): NewDestination => ({
  id: stop.id,
  placeKey: stop.placeKey,
  name: stop.name,
  countryCode: stop.countryCode,
  region: stop.region,
  latitude: stop.latitude,
  longitude: stop.longitude,
  nights: stop.nights,
  note: stop.note,
  legMode: stop.legMode,
  visited: stop.visited,
  spotRoute: stop.spotRoute,
  spots: stop.spots,
  todos: stop.todos,
  photos: stop.photos,
});

// --- Operations ------------------------------------------------------------------------------------------

/**
 * Asks Pip for a change list. The model sees this trip's plan only (never the person's name, email, home or
 * other trips) and answers JSON that is validated here; nothing on the trip changes until the person applies it.
 */
export function createAskPip(
  deps: Pick<
    Ports,
    | 'unitOfWork'
    | 'clock'
    | 'ids'
    | 'ai'
    | 'trips'
    | 'destinations'
    | 'dayPlaces'
    | 'checklist'
    | 'expenses'
    | 'savings'
    | 'preferences'
    | 'assistant'
    | 'billing'
  >,
) {
  return defineOperation({
    name: 'askPip',
    kind: 'command',
    input: askPipFields.extend({ tripId: tripIdSchema }),
    output: proposalSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'edit');
      const used = await deps.assistant.countRequestsSince(
        actor.userId,
        new Date(now.getTime() - DAY_MS),
      );
      if (used >= PIP_DAILY_CAP) throw new RateLimitedError('Pip needs a rest: try tomorrow');
      // One credit per answered request: monthly (or trial) credits first, then bought ones.
      const { account, rights } = await loadRights(deps.billing, actor, now);
      const balance = creditBalance({
        entitlements: rights,
        usedInPeriod: await deps.assistant.countRequestsSince(actor.userId, rights.periodStart),
        topUpBalance: account.topUpBalance,
      });
      if (balance.next === null) {
        throw new PlanLimitError('OUT_OF_CREDITS', 'Pip credits are used up for this period');
      }
      const locale = (await deps.preferences.find(actor.userId))?.locale ?? 'en';
      const { context, refs, stops } = await contextFor(deps, trip, now);
      // "Fill this pin": real places near one of this trip's stops, named "c1", "c2"… for the model.
      const candidates = new Map<string, SpotCandidate>();
      let pinContext: PipContext = context;
      if (input.spotCandidates) {
        const stop = stops.find(
          (candidate) => candidate.placeKey === input.spotCandidates!.placeKey,
        );
        if (!stop) throw new NotFoundError();
        const stopRef = [...refs].find(([, id]) => id === stop.id)?.[0] ?? '';
        const taken = new Set(stop.spots.map((spot) => spot.name.toLowerCase()));
        for (const place of input.spotCandidates.places) {
          if (distanceKm(stop, place) > PIP_SPOT_CANDIDATE_RADIUS_KM) continue;
          if (taken.has(place.name.toLowerCase())) continue;
          taken.add(place.name.toLowerCase());
          candidates.set(`c${candidates.size + 1}`, {
            stopId: stop.id,
            name: place.name,
            spotKind: spotKindOf(place.kind),
            latitude: place.latitude,
            longitude: place.longitude,
          });
        }
        pinContext = {
          ...context,
          candidates: {
            stopId: stopRef,
            places: [...candidates].map(([id, place]) => ({
              id,
              name: place.name,
              kind: place.spotKind,
            })),
          },
        };
      }
      const answer = await deps.ai.completeJson({
        system: systemPrompt(locale),
        user: userPrompt(input.request, pinContext, now.toISOString().slice(0, 10)),
        maxTokens: MAX_OUTPUT_TOKENS,
      });
      if (!answer) throw new UnavailableError('Pip is not available right now');
      let parsed: { summary?: unknown; changes?: unknown } = {};
      try {
        parsed = JSON.parse(answer.content) as typeof parsed;
      } catch {
        parsed = {};
      }
      const proposed = validChanges(parsed.changes, refs, trip.currency, candidates);
      // Asked to fill one pin, Pip answers spots for that pin and nothing else.
      const changes = input.spotCandidates
        ? proposed.filter((change) => change.kind === 'addSpot')
        : proposed;
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 300) : '';
      const id = deps.ids.newId();
      return deps.unitOfWork.run(async (tx) => {
        if (balance.next === 'top-up') {
          await tx.billing.addCredits({
            id: deps.ids.newId(),
            userId: actor.userId,
            delta: -1,
            reason: 'pip',
            ref: null,
            createdAt: now,
          });
        }
        await tx.assistant.recordUsage({
          id: deps.ids.newId(),
          userId: actor.userId,
          provider: answer.provider,
          model: answer.model,
          inputTokens: answer.inputTokens,
          outputTokens: answer.outputTokens,
          createdAt: now,
        });
        await tx.assistant.insertProposal({
          id,
          ownerId: actor.userId,
          tripId: trip.id,
          request: input.request,
          summary,
          changes,
          createdAt: now,
        });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'pip.propose',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { changes: changes.length, kinds: [...new Set(changes.map((c) => c.kind))] },
        });
        return toView((await tx.assistant.findProposal(id))!, trip.currency, now);
      });
    },
  });
}

export function createListProposals(deps: Pick<Ports, 'trips' | 'assistant' | 'clock'>) {
  return defineOperation({
    name: 'listProposals',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: proposalListSchema,
    async handler(actor, input) {
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'view');
      const now = deps.clock.now();
      const records = await deps.assistant.listProposals(trip.id, 10);
      return { proposals: records.map((record) => toView(record, trip.currency, now)) };
    },
  });
}

/** Applies the chosen changes in one transaction and keeps what "Undo" needs. */
async function apply(
  tx: Transaction,
  deps: Pick<Ports, 'ids'>,
  trip: TripRecord,
  changes: readonly PipChange[],
  now: Date,
): Promise<UndoData> {
  const before = await tx.destinations.listByTrip(trip.id);
  let route: NewDestination[] = before.map(asNew);
  let routeChanged = false;
  const order: PipChange['kind'][] = ['removeStop', 'setNights', 'addStop', 'reorder', 'addSpot'];
  for (const kind of order) {
    for (const change of changes.filter((c) => c.kind === kind)) {
      if (change.kind === 'removeStop') {
        route = route.filter((stop) => stop.id !== change.stopId);
      } else if (change.kind === 'setNights') {
        route = route.map((stop) =>
          stop.id === change.stopId ? { ...stop, nights: change.nights } : stop,
        );
      } else if (change.kind === 'addStop') {
        const stop: NewDestination = {
          id: deps.ids.newId(),
          placeKey:
            `pip:${change.name}:${change.latitude.toFixed(3)},${change.longitude.toFixed(3)}`.slice(
              0,
              200,
            ),
          name: change.name,
          countryCode: change.countryCode,
          region: null,
          latitude: change.latitude,
          longitude: change.longitude,
          nights: change.nights,
          note: null,
          legMode: null,
          visited: false,
          spotRoute: false,
          spots: [],
          todos: [],
          photos: [],
        };
        const at = change.afterStopId
          ? route.findIndex((s) => s.id === change.afterStopId) + 1
          : route.length;
        route = [...route.slice(0, at || route.length), stop, ...route.slice(at || route.length)];
      } else if (change.kind === 'addSpot') {
        route = route.map((stop) =>
          stop.id === change.stopId &&
          stop.spots.length < STOP_SPOTS_MAX &&
          !stop.spots.some((spot) => spot.name.toLowerCase() === change.name.toLowerCase())
            ? {
                ...stop,
                spots: [
                  ...stop.spots,
                  {
                    name: change.name,
                    kind: change.spotKind,
                    latitude: change.latitude,
                    longitude: change.longitude,
                    done: false,
                  },
                ],
              }
            : stop,
        );
      } else if (change.kind === 'reorder') {
        const rank = new Map(change.order.map((stopId, index) => [stopId, index]));
        route = [...route].sort(
          (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
        );
      }
      routeChanged = true;
    }
  }
  if (routeChanged) await tx.destinations.replaceForTrip(trip.id, route, now);

  const placeIds: string[] = [];
  const checklistIds: string[] = [];
  const expenseIds: string[] = [];
  const stopIds = new Set(route.map((stop) => stop.id));

  const places = changes.filter((c) => c.kind === 'addPlace');
  if (places.length > 0) {
    const existing = await tx.dayPlaces.listByTrip(trip.id);
    let position = existing.reduce((max, place) => Math.max(max, place.position + 1), 0);
    for (const change of places.slice(0, Math.max(0, DAY_PLACES_MAX - existing.length))) {
      const id = deps.ids.newId();
      await tx.dayPlaces.insert({
        id,
        tripId: trip.id,
        destinationId: change.stopId && stopIds.has(change.stopId) ? change.stopId : null,
        name: change.name,
        minutes: change.minutes,
        day: null,
        position: position++,
        createdAt: now,
      });
      placeIds.push(id);
    }
  }

  const items = changes.filter((c) => c.kind === 'addChecklistItem');
  if (items.length > 0) {
    const room = CHECKLIST_MAX_ITEMS - (await tx.checklist.countByTrip(trip.id));
    const rows = items.slice(0, Math.max(0, room)).map((change) => ({
      id: deps.ids.newId(),
      tripId: trip.id,
      group: change.group,
      label: change.label,
      done: false,
      createdAt: now,
    }));
    if (rows.length > 0) await tx.checklist.insertMany(rows);
    checklistIds.push(...rows.map((row) => row.id));
  }

  for (const change of changes.filter((c) => c.kind === 'addExpense')) {
    const amountMinor = minor(change.amount, trip.currency);
    if (amountMinor === null) continue;
    const id = deps.ids.newId();
    await tx.expenses.insert({
      id,
      tripId: trip.id,
      category: change.category,
      status: 'estimate',
      description: change.description,
      amountMinor,
      currency: trip.currency,
      tripAmountMinor: amountMinor,
      fxRate: null,
      fxSource: null,
      fxAsOf: null,
      // A cost Pip proposes is a real line of the budget, never the trip's rough guess.
      guess: false,
      createdAt: now,
    });
    expenseIds.push(id);
  }

  let monthlyMinor: string | null = null;
  const monthly = changes.find((c) => c.kind === 'setMonthly');
  if (monthly) {
    const value = minor(monthly.amount, trip.currency);
    if (value !== null) {
      monthlyMinor = ((await tx.savings.find(trip.id))?.monthlyMinor ?? 0n).toString();
      await tx.savings.upsert(trip.id, { monthlyMinor: value }, now);
    }
  }

  return { route: routeChanged ? before : null, monthlyMinor, placeIds, checklistIds, expenseIds };
}

export function createApplyProposal(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'applyProposal',
    kind: 'command',
    input: applyProposalFields.extend({ proposalId: z.uuid() }),
    output: proposalSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const proposal = await loadOwnProposal(tx.assistant, actor, input.proposalId);
        const trip = await loadTripFor(tx.trips, actor, proposal.tripId, 'edit');
        const status = isStatus(proposal.status) ? proposal.status : 'discarded';
        if (!canDecide({ status, decidedAt: proposal.decidedAt }, 'apply', now)) {
          refuse('already_decided', 'This proposal was already applied or discarded');
        }
        const all = toView(proposal, trip.currency, now).changes;
        const chosen = [...new Set(input.include)].filter((index) => index < all.length).sort();
        const undo = await apply(
          tx,
          deps,
          trip,
          chosen.map((index) => all[index]!),
          now,
        );
        await tx.assistant.updateProposal(proposal.id, {
          status: 'applied',
          decidedAt: now,
          applied: chosen,
          undo,
        });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'pip.apply',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { applied: chosen.length, offered: all.length },
        });
        return toView((await tx.assistant.findProposal(proposal.id))!, trip.currency, now);
      });
    },
  });
}

export function createDiscardProposal(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'discardProposal',
    kind: 'command',
    input: z.object({ proposalId: z.uuid() }),
    output: proposalSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const proposal = await loadOwnProposal(tx.assistant, actor, input.proposalId);
        const trip = await loadTripFor(tx.trips, actor, proposal.tripId, 'edit');
        const status = isStatus(proposal.status) ? proposal.status : 'discarded';
        if (!canDecide({ status, decidedAt: proposal.decidedAt }, 'discard', now)) {
          refuse('already_decided', 'This proposal was already applied or discarded');
        }
        await tx.assistant.updateProposal(proposal.id, { status: 'discarded', decidedAt: now });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'pip.discard',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });
        return toView((await tx.assistant.findProposal(proposal.id))!, trip.currency, now);
      });
    },
  });
}

/**
 * Puts the trip back as it was before the proposal was applied: the route (as it was then), the monthly
 * amount, and removes what applying added. Within 24 hours.
 */
export function createUndoProposal(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'undoProposal',
    kind: 'command',
    input: z.object({ proposalId: z.uuid() }),
    output: proposalSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const proposal = await loadOwnProposal(tx.assistant, actor, input.proposalId);
        const trip = await loadTripFor(tx.trips, actor, proposal.tripId, 'edit');
        const status = isStatus(proposal.status) ? proposal.status : 'discarded';
        if (!canDecide({ status, decidedAt: proposal.decidedAt }, 'undo', now)) {
          refuse('not_undoable', 'This proposal cannot be undone any more');
        }
        const undo = proposal.undo as UndoData | null;
        if (undo?.route) {
          const restored = undo.route.map((stop) =>
            asNew({ ...stop, photos: stop.photos ?? [] } as DestinationRecord),
          );
          await tx.destinations.replaceForTrip(trip.id, restored, now);
        }
        for (const id of undo?.placeIds ?? []) {
          if (await tx.dayPlaces.findById(id)) await tx.dayPlaces.delete(id);
        }
        for (const id of undo?.checklistIds ?? []) {
          if (await tx.checklist.findById(id)) await tx.checklist.delete(id);
        }
        for (const id of undo?.expenseIds ?? []) {
          if (await tx.expenses.findById(id)) await tx.expenses.delete(id);
        }
        if (undo?.monthlyMinor !== null && undo?.monthlyMinor !== undefined) {
          await tx.savings.upsert(trip.id, { monthlyMinor: BigInt(undo.monthlyMinor) }, now);
        }
        await tx.assistant.updateProposal(proposal.id, { status: 'undone', decidedAt: now });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'pip.undo',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });
        return toView((await tx.assistant.findProposal(proposal.id))!, trip.currency, now);
      });
    },
  });
}
