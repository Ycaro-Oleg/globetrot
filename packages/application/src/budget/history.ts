import { money, toDecimalString, type Money } from '@globetrot/domain';
import { z } from 'zod';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { loadTripFor } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';
import { moneySchema } from './schemas';

const view = (value: Money) => ({ amount: toDecimalString(value), currency: value.currency });

export const savingsHistorySchema = z.object({
  currency: z.string(),
  /** What the trip has set aside now (everyone's savings on a trip planned together). */
  saved: moneySchema,
  /** What was set aside before the first week shown (savings typed in rather than checked in). */
  start: moneySchema,
  /** One entry per week with a check-in, oldest first: what was set aside that week and the running total. */
  weeks: z.array(
    z.object({
      /** ISO week, `2027-W05`. */
      week: z.string(),
      amount: moneySchema,
      saved: moneySchema,
    }),
  ),
});

/**
 * How the trip's savings grew (ADR-0026 check-ins): the weekly check-ins added up per week, and the running total
 * that ends at what is set aside today. Savings typed in directly (not checked in) count as the starting balance.
 */
export function createGetSavingsHistory(deps: Pick<Ports, 'trips' | 'members' | 'savings'>) {
  return defineOperation({
    name: 'getSavingsHistory',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: savingsHistorySchema,
    async handler(actor, input) {
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'view');
      const [members, savings, checkins] = await Promise.all([
        deps.members.listByTrip(trip.id),
        deps.savings.find(trip.id),
        deps.savings.listTripCheckins(trip.id),
      ]);
      // On a trip planned together each person keeps their own savings; otherwise the trip has one balance.
      const savedMinor =
        members.length > 0
          ? (await deps.members.listMoney(trip.id)).reduce(
              (sum, entry) => sum + entry.savedMinor,
              0n,
            )
          : (savings?.savedMinor ?? 0n);
      const checkedIn = checkins.reduce((sum, checkin) => sum + checkin.amountMinor, 0n);
      const startMinor = savedMinor > checkedIn ? savedMinor - checkedIn : 0n;
      let running = startMinor;
      const weeks = checkins.map((checkin) => {
        running += checkin.amountMinor;
        return {
          week: checkin.week,
          amount: view(money(checkin.amountMinor, trip.currency)),
          saved: view(money(running, trip.currency)),
        };
      });
      return {
        currency: trip.currency,
        saved: view(money(savedMinor, trip.currency)),
        start: view(money(startMinor, trip.currency)),
        weeks,
      };
    },
  });
}
