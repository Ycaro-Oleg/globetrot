import {
  addMonths,
  fromDecimal,
  groupSavings,
  money,
  MoneyError,
  settleUp,
  toDecimalString,
  toLocalDate,
  tripTotals,
  validShares,
  yearMonthOf,
  type Money,
  type ShareMember,
} from '@globetrot/domain';
import { z } from 'zod';
import { ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports, TripRecord } from '../ports';
import { planOf } from '../budget/operations';
import { moneySchema, nonNegativeAmountSchema } from '../budget/schemas';
import { loadOwnedTrip, loadTripFor } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';

const view = (value: Money) => ({ amount: toDecimalString(value), currency: value.currency });

function invalid(field: string, message: string): never {
  throw new ValidationError([{ field, code: 'custom', message }]);
}

function parse(amount: string, currency: string, field: string): bigint {
  try {
    return fromDecimal(amount, currency).amountMinor;
  } catch (error) {
    if (error instanceof MoneyError) invalid(field, error.message);
    throw error;
  }
}

export const groupMoneySchema = z.object({
  currency: z.string(),
  /** Whether the parts are custom (basis points) or an equal split. */
  custom: z.boolean(),
  people: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      you: z.boolean(),
      /** 0 to 10 000 when parts are custom; null for an equal split. */
      shareBp: z.number().int().nullable(),
      share: moneySchema,
      saved: moneySchema,
      monthly: moneySchema,
      left: moneySchema,
      /** `YYYY-MM` when this person has their part at their monthly amount; null without one. */
      readyMonth: z.string().nullable(),
    }),
  ),
  group: z.object({ total: moneySchema, saved: moneySchema, left: moneySchema }),
  settlement: z.object({
    /** Who pays whom so that everyone has paid their part of the costs already paid. */
    transfers: z.array(
      z.object({
        from: z.string(),
        to: z.string(),
        fromName: z.string(),
        toName: z.string(),
        amount: moneySchema,
      }),
    ),
    /** What was paid by someone on the trip. */
    paid: moneySchema,
    /** Paid costs nobody is named on: left out of the settling. */
    unassigned: moneySchema,
  }),
});

/** Everyone on the trip in order (the owner first), with their name. */
async function peopleOf(deps: Pick<Ports, 'members' | 'users'>, trip: TripRecord) {
  const [owner, members] = await Promise.all([
    deps.users.findById(trip.ownerId),
    deps.members.listByTrip(trip.id),
  ]);
  return [
    { userId: trip.ownerId, name: owner?.name ?? '' },
    ...members.map((member) => ({ userId: member.userId, name: member.name })),
  ];
}

/**
 * Each person's part of the trip's cost, what they set aside and when they will have it, the group's progress,
 * and who pays whom to settle the costs already paid (ADR-0025). Anyone on the trip may see it.
 */
export function createGetGroupMoney(
  deps: Pick<Ports, 'trips' | 'members' | 'users' | 'expenses' | 'savings' | 'clock'>,
) {
  return defineOperation({
    name: 'getGroupMoney',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: groupMoneySchema,
    async handler(actor, input) {
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'view');
      const [people, records, expenses, savings] = await Promise.all([
        peopleOf(deps, trip),
        deps.members.listMoney(trip.id),
        deps.expenses.listByTrip(trip.id),
        deps.savings.find(trip.id),
      ]);
      const byUser = new Map(records.map((record) => [record.userId, record]));
      const custom = people.some((person) => (byUser.get(person.userId)?.shareBp ?? null) !== null);
      const members: ShareMember[] = people.map((person) => ({
        userId: person.userId,
        shareBp: custom ? (byUser.get(person.userId)?.shareBp ?? 0) : null,
      }));
      const total = tripTotals(planOf(trip, expenses, savings)).total;
      const group = groupSavings(
        total.amountMinor,
        members,
        people.map((person) => ({
          userId: person.userId,
          savedMinor: byUser.get(person.userId)?.savedMinor ?? 0n,
          monthlyMinor: byUser.get(person.userId)?.monthlyMinor ?? 0n,
        })),
      );
      // Settling up counts only costs already paid; a guess is never paid.
      const settlement = settleUp(
        expenses
          .filter((expense) => expense.status === 'paid' && !expense.guess)
          .map((expense) => ({ paidBy: expense.paidBy, amountMinor: expense.tripAmountMinor })),
        members,
      );
      const names = new Map(people.map((person) => [person.userId, person.name]));
      const thisMonth = yearMonthOf(toLocalDate(deps.clock.now().toISOString().slice(0, 10)));
      const m = (minor: bigint) => view(money(minor, trip.currency));
      return {
        currency: trip.currency,
        custom,
        people: group.people.map((person) => ({
          userId: person.userId,
          name: names.get(person.userId) ?? '',
          you: person.userId === actor.userId,
          shareBp: custom ? (byUser.get(person.userId)?.shareBp ?? 0) : null,
          share: m(person.shareMinor),
          saved: m(person.savedMinor),
          monthly: m(person.monthlyMinor),
          left: m(person.leftMinor),
          readyMonth: person.ready
            ? thisMonth
            : person.monthlyMinor > 0n
              ? addMonths(
                  thisMonth,
                  Number((person.leftMinor + person.monthlyMinor - 1n) / person.monthlyMinor),
                )
              : null,
        })),
        group: { total: view(total), saved: m(group.savedMinor), left: m(group.leftMinor) },
        settlement: {
          transfers: settlement.transfers.map((transfer) => ({
            from: transfer.from,
            to: transfer.to,
            fromName: names.get(transfer.from) ?? '',
            toName: names.get(transfer.to) ?? '',
            amount: m(transfer.amountMinor),
          })),
          paid: m(settlement.balances.reduce((sum, b) => sum + b.paidMinor, 0n)),
          unassigned: m(settlement.unassignedMinor),
        },
      };
    },
  });
}

/**
 * The caller's own savings for their part of the trip: what they set aside and what they put aside each month.
 * Personal, so a viewer may keep theirs too.
 */
export function createUpdateMyMoney(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'updateMyMoney',
    kind: 'command',
    input: z.object({
      tripId: tripIdSchema,
      saved: nonNegativeAmountSchema.optional(),
      monthly: nonNegativeAmountSchema.optional(),
    }),
    output: z.object({ saved: z.boolean() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadTripFor(tx.trips, actor, input.tripId, 'view');
        const patch: { savedMinor?: bigint; monthlyMinor?: bigint } = {};
        if (input.saved !== undefined)
          patch.savedMinor = parse(input.saved, trip.currency, 'saved');
        if (input.monthly !== undefined) {
          patch.monthlyMinor = parse(input.monthly, trip.currency, 'monthly');
        }
        await tx.members.upsertMoney(trip.id, actor.userId, patch, now);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.money.update',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { fields: Object.keys(patch) },
        });
        return { saved: true };
      });
    },
  });
}

/**
 * Who pays how much of the trip (owner only): custom parts in basis points that add up to 10 000, or `null`
 * for an equal split.
 */
export function createSetShares(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids' | 'users'>) {
  return defineOperation({
    name: 'setShares',
    kind: 'command',
    input: z.object({
      tripId: tripIdSchema,
      shares: z
        .array(z.object({ userId: z.string().min(1).max(64), shareBp: z.number().int() }))
        .nullable()
        .meta({
          description: 'Everyone’s part in basis points (10 000 in all), or null to split equally.',
        }),
    }),
    output: z.object({ saved: z.boolean() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        const people = await peopleOf({ members: tx.members, users: deps.users }, trip);
        let shares: { userId: string; shareBp: number | null }[];
        if (input.shares === null) {
          shares = people.map((person) => ({ userId: person.userId, shareBp: null }));
        } else {
          const ids = new Set(people.map((person) => person.userId));
          const given = new Set(input.shares.map((share) => share.userId));
          if (
            given.size !== input.shares.length ||
            given.size !== ids.size ||
            [...given].some((id) => !ids.has(id)) ||
            !validShares(input.shares.map((share) => share.shareBp))
          ) {
            invalid('shares', 'Give everyone on the trip a part, adding up to the whole trip');
          }
          shares = input.shares;
        }
        await tx.members.setShares(trip.id, shares, now);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.shares.update',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { custom: input.shares !== null },
        });
        return { saved: true };
      });
    },
  });
}
