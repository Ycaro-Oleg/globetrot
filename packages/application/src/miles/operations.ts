import {
  addMonths,
  brlIn,
  localDateIn,
  memberShares,
  money,
  MILES_MAX_BALANCE,
  MILES_PROGRAMS,
  MILES_RESEARCHED_ON,
  MILES_SOURCES,
  milesTotal,
  milesValue,
  toDecimalString,
  tripTotals,
  yearMonthOf,
  type Money,
} from '@globetrot/domain';
import { z } from 'zod';
import { planOf } from '../budget/operations';
import { moneySchema } from '../budget/schemas';
import { ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { loadTripFor } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';

const view = (value: Money) => ({ amount: toDecimalString(value), currency: value.currency });
const programSchema = z.enum(MILES_PROGRAMS);
const milesSchema = z.number().int().min(0).max(MILES_MAX_BALANCE);

export const milesSchema_ = z.object({
  programs: z.array(
    z.object({
      program: programSchema,
      balance: z.number().int(),
      /** Put towards this trip. */
      onTrip: z.number().int(),
      /** What the balance is typically worth, in reais. */
      value: z.object({ low: moneySchema, high: moneySchema }),
    }),
  ),
  researchedOn: z.string(),
  sources: z.array(z.string()),
  /** What the miles put towards the trip are typically worth, in the trip's currency; null without them. */
  applied: z.object({ low: moneySchema, high: moneySchema, middle: moneySchema }).nullable(),
  /** The savings answer counting the middle of that value: what is left and when it is ready. */
  withMiles: z.object({ left: moneySchema, readyMonth: z.string().nullable() }).nullable(),
});

/**
 * The person's miles and what they are typically worth (ADR-0030), the miles they put towards this trip, and the
 * savings answer counting them: their own part on a shared trip, the trip's otherwise. Always estimates.
 */
export function createGetMiles(
  deps: Pick<
    Ports,
    'trips' | 'members' | 'users' | 'savings' | 'expenses' | 'preferences' | 'clock'
  >,
) {
  return defineOperation({
    name: 'getMiles',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: milesSchema_,
    async handler(actor, input) {
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'view');
      const [balances, onTrip, expenses, savings, members, preferences] = await Promise.all([
        deps.savings.listMiles(actor.userId),
        deps.savings.listTripMiles(trip.id, actor.userId),
        deps.expenses.listByTrip(trip.id),
        deps.savings.find(trip.id),
        deps.members.listByTrip(trip.id),
        deps.preferences.find(actor.userId),
      ]);
      const total = tripTotals(planOf(trip, expenses, savings)).total;
      // What is left to save and the monthly amount: the person's own part on a shared trip.
      let left: bigint;
      let monthly: bigint;
      if (members.length > 0) {
        const records = await deps.members.listMoney(trip.id);
        const custom = records.some((record) => record.shareBp !== null);
        const shares = memberShares(
          total.amountMinor,
          [trip.ownerId, ...members.map((member) => member.userId)].map((userId) => ({
            userId,
            shareBp: custom ? (records.find((r) => r.userId === userId)?.shareBp ?? 0) : null,
          })),
        );
        const mine = records.find((record) => record.userId === actor.userId);
        const share = shares.get(actor.userId) ?? 0n;
        const saved = mine?.savedMinor ?? 0n;
        left = share > saved ? share - saved : 0n;
        monthly = mine?.monthlyMinor ?? 0n;
      } else {
        const saved = savings?.savedMinor ?? 0n;
        left = total.amountMinor > saved ? total.amountMinor - saved : 0n;
        monthly = savings?.monthlyMinor ?? 0n;
      }
      const onTripBy = new Map(onTrip.map((entry) => [entry.program, entry.miles]));
      const value = milesTotal(
        onTrip.map((entry) => ({ program: entry.program, balance: entry.miles })),
      );
      const low = brlIn(value.low, trip.currency);
      const high = brlIn(value.high, trip.currency);
      const middle = brlIn(value.middle, trip.currency);
      const applied = onTrip.length > 0 && low && high && middle ? { low, high, middle } : null;
      let withMiles: { left: Money; readyMonth: string | null } | null = null;
      if (applied) {
        const rest = left > applied.middle.amountMinor ? left - applied.middle.amountMinor : 0n;
        const thisMonth = yearMonthOf(localDateIn(deps.clock.now(), preferences?.timeZone));
        withMiles = {
          left: money(rest, trip.currency),
          readyMonth:
            rest === 0n
              ? thisMonth
              : monthly > 0n
                ? addMonths(thisMonth, Number((rest + monthly - 1n) / monthly))
                : null,
        };
      }
      return {
        programs: balances.map((entry) => {
          const worth = milesValue(entry.program, entry.balance);
          return {
            program: entry.program,
            balance: entry.balance,
            onTrip: onTripBy.get(entry.program) ?? 0,
            value: { low: view(worth.low), high: view(worth.high) },
          };
        }),
        researchedOn: MILES_RESEARCHED_ON,
        sources: [...MILES_SOURCES],
        applied: applied
          ? { low: view(applied.low), high: view(applied.high), middle: view(applied.middle) }
          : null,
        withMiles: withMiles
          ? { left: view(withMiles.left), readyMonth: withMiles.readyMonth }
          : null,
      };
    },
  });
}

/** A programme's balance; zero removes it and what was put towards trips from it. */
export function createSetMiles(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'setMiles',
    kind: 'command',
    input: z.object({ program: programSchema, balance: milesSchema }),
    output: z.object({ saved: z.boolean() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        await tx.savings.setMiles(actor.userId, input.program, input.balance, now);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'miles.balance',
          entityType: 'account',
          entityId: actor.userId,
          metadata: { program: input.program },
        });
        return { saved: true };
      });
    },
  });
}

/** How many of the person's miles of a programme go towards a trip; never more than they have. */
export function createSetTripMiles(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'setTripMiles',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, program: programSchema, miles: milesSchema }),
    output: z.object({ saved: z.boolean() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadTripFor(tx.trips, actor, input.tripId, 'view');
        const balance =
          (await tx.savings.listMiles(actor.userId)).find(
            (entry) => entry.program === input.program,
          )?.balance ?? 0;
        if (input.miles > balance) {
          throw new ValidationError([
            { field: 'miles', code: 'too_many', message: 'More miles than the balance' },
          ]);
        }
        await tx.savings.setTripMiles(trip.id, actor.userId, input.program, input.miles, now);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'miles.trip',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { program: input.program },
        });
        return { saved: true };
      });
    },
  });
}
