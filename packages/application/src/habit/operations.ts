import {
  checkinStreak,
  fromDecimal,
  isoWeekOf,
  localDateIn,
  money,
  MoneyError,
  toDecimalString,
  toLocalDate,
  TRIP_PHASES,
  tripCountdown,
  type IsoWeek,
  type Money,
} from '@globetrot/domain';
import { z } from 'zod';
import { ValidationError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports, TripRecord, Transaction } from '../ports';
import { moneySchema, nonNegativeAmountSchema } from '../budget/schemas';
import { loadTripFor } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';

const view = (value: Money) => ({ amount: toDecimalString(value), currency: value.currency });

export const habitSchema = z.object({
  /** The ISO week it is for the person (`2027-W05`). */
  week: z.string(),
  /** What they checked in this week, or null when not yet. */
  checkedIn: moneySchema.nullable(),
  /** Weeks in a row with a check-in. */
  streak: z.number().int(),
  /** A week's share of their monthly amount, to offer as the check-in. */
  suggested: moneySchema,
  countdown: z.object({
    daysLeft: z.number().int().nullable(),
    phase: z.enum(TRIP_PHASES).nullable(),
    /** Checklist suggestions for the phase, as stable keys. */
    tasks: z.array(z.string()),
  }),
});

/** Whether the trip's savings are kept per person (it is planned together) or for the trip as a whole. */
async function sharedTrip(
  source: Pick<Ports, 'members'> | Pick<Transaction, 'members'>,
  trip: TripRecord,
) {
  return (await source.members.listByTrip(trip.id)).length > 0;
}

/** The person's monthly amount for the trip: their own on a shared trip, the trip's otherwise. */
async function monthlyFor(
  source: Pick<Ports, 'members' | 'savings'> | Pick<Transaction, 'members' | 'savings'>,
  trip: TripRecord,
  userId: string,
  shared: boolean,
): Promise<bigint> {
  if (shared) {
    const mine = (await source.members.listMoney(trip.id)).find((entry) => entry.userId === userId);
    return mine?.monthlyMinor ?? 0n;
  }
  return (await source.savings.find(trip.id))?.monthlyMinor ?? 0n;
}

/**
 * The saving habit on a trip (ADR-0026): this week's check-in, the streak, a suggested amount (a week's share of
 * the monthly amount) and the countdown phase with its checklist suggestions.
 */
export function createGetHabit(
  deps: Pick<Ports, 'trips' | 'members' | 'savings' | 'destinations' | 'preferences' | 'clock'>,
) {
  return defineOperation({
    name: 'getHabit',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: habitSchema,
    async handler(actor, input) {
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'view');
      const [preferences, checkins, stops, shared] = await Promise.all([
        deps.preferences.find(actor.userId),
        deps.savings.listCheckins(trip.id, actor.userId),
        deps.destinations.listByTrip(trip.id),
        sharedTrip(deps, trip),
      ]);
      const today = localDateIn(deps.clock.now(), preferences?.timeZone);
      const week = isoWeekOf(today);
      const thisWeek = checkins.find((checkin) => checkin.week === week);
      const monthly = await monthlyFor(deps, trip, actor.userId, shared);
      const nights = stops.reduce((sum, stop) => sum + stop.nights, 0);
      const countdown = tripCountdown(
        trip.startDate ? toLocalDate(trip.startDate) : null,
        nights,
        today,
      );
      return {
        week,
        checkedIn: thisWeek ? view(money(thisWeek.amountMinor, trip.currency)) : null,
        streak: checkinStreak(
          checkins.map((checkin) => checkin.week as IsoWeek),
          week,
        ),
        // A month is about 4.35 weeks; round to whole units so the offer reads cleanly.
        suggested: view(money(((monthly * 100n) / 435n / 100n) * 100n, trip.currency)),
        countdown: {
          daysLeft: countdown.daysLeft,
          phase: countdown.phase,
          tasks: [...countdown.tasks],
        },
      };
    },
  });
}

/**
 * "I set this aside this week": records the week's check-in and adds it to the person's savings (their own on a
 * shared trip, the trip's otherwise). Checking in again the same week changes the amount, not adds to it.
 */
export function createCheckIn(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids' | 'preferences'>) {
  return defineOperation({
    name: 'checkIn',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, amount: nonNegativeAmountSchema }),
    output: z.object({ week: z.string(), amount: moneySchema }),
    async handler(actor, input) {
      const now = deps.clock.now();
      const preferences = await deps.preferences.find(actor.userId);
      const week = isoWeekOf(localDateIn(now, preferences?.timeZone));
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadTripFor(tx.trips, actor, input.tripId, 'view');
        let amountMinor: bigint;
        try {
          amountMinor = fromDecimal(input.amount, trip.currency).amountMinor;
        } catch (error) {
          if (error instanceof MoneyError) {
            throw new ValidationError([
              { field: 'amount', code: 'invalid_format', message: error.message },
            ]);
          }
          throw error;
        }
        const before = await tx.savings.upsertCheckin({
          tripId: trip.id,
          userId: actor.userId,
          week,
          amountMinor,
          createdAt: now,
        });
        const delta = amountMinor - (before ?? 0n);
        if (await sharedTrip(tx, trip)) {
          const mine = (await tx.members.listMoney(trip.id)).find((e) => e.userId === actor.userId);
          const saved = (mine?.savedMinor ?? 0n) + delta;
          await tx.members.upsertMoney(
            trip.id,
            actor.userId,
            { savedMinor: saved < 0n ? 0n : saved },
            now,
          );
        } else {
          const current = (await tx.savings.find(trip.id))?.savedMinor ?? 0n;
          const saved = current + delta;
          await tx.savings.upsert(trip.id, { savedMinor: saved < 0n ? 0n : saved }, now);
        }
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'savings.checkin',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { week },
        });
        return { week, amount: view(money(amountMinor, trip.currency)) };
      });
    },
  });
}
