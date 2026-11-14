import { z } from 'zod';
import { budgetOf } from '../budget/operations';
import { moneySchema } from '../budget/schemas';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { loadOwnedTrip } from './operations';
import { tripIdSchema } from './schemas';

/**
 * A trip's public link (docs/product/business-rules.md#sharing-a-trip): the owner turns it on, chooses whether
 * amounts show, and can turn it off at any time (that stays open even when the account is read-only). The page
 * shows the route, the month (never the day) and the savings answer; never the person's name or email.
 */

export const tripShareSchema = z.object({
  slug: z.string().nullable(),
  showAmounts: z.boolean(),
});

export const sharedTripSchema = z.object({
  title: z.string(),
  /** `YYYY-MM`: the month only, so nobody learns the day the house is empty. */
  startMonth: z.string().nullable(),
  totalNights: z.number().int(),
  stops: z.array(
    z.object({
      name: z.string(),
      countryCode: z.string().nullable(),
      nights: z.number().int(),
      latitude: z.number(),
      longitude: z.number(),
    }),
  ),
  savings: z.object({
    status: z.enum(['no-costs', 'saving', 'fully-saved']),
    progressBasisPoints: z.number().int(),
    readyMonth: z.string().nullable(),
  }),
  /** Only when the owner chose to show amounts. */
  amounts: z.object({ total: moneySchema, saved: moneySchema, monthly: moneySchema }).nullable(),
});
export type SharedTripView = z.infer<typeof sharedTripSchema>;

export const SHARE_SLUG = /^[A-Za-z0-9_-]{22}$/;

export function createGetTripShare(deps: Pick<Ports, 'trips' | 'shares'>) {
  return defineOperation({
    name: 'getTripShare',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: tripShareSchema,
    async handler(actor, input) {
      const trip = await loadOwnedTrip(deps.trips, actor, input.tripId);
      const share = await deps.shares.findByTrip(trip.id);
      return { slug: share?.slug ?? null, showAmounts: share?.showAmounts ?? false };
    },
  });
}

/** Turns the link on (keeping its address if it was on) and sets whether amounts show. */
export function createShareTrip(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'shareTrip',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, showAmounts: z.boolean().default(false) }),
    output: tripShareSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        const current = await tx.shares.findByTrip(trip.id);
        let slug = current?.slug;
        if (!current) {
          slug = deps.ids.newToken();
          await tx.shares.insert({
            slug,
            tripId: trip.id,
            ownerId: actor.userId,
            showAmounts: input.showAmounts,
            createdAt: now,
          });
        } else if (current.showAmounts !== input.showAmounts) {
          await tx.shares.setShowAmounts(trip.id, input.showAmounts);
        }
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.share',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { showAmounts: input.showAmounts },
        });
        return { slug: slug!, showAmounts: input.showAmounts };
      });
    },
  });
}

/** Turns the link off for good: the old address answers "not found". */
export function createUnshareTrip(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'unshareTrip',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema }),
    output: tripShareSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        if (await tx.shares.findByTrip(trip.id)) {
          await tx.shares.deleteByTrip(trip.id);
          await tx.audit.record({
            id: deps.ids.newId(),
            occurredAt: now,
            actor,
            action: 'trip.unshare',
            entityType: 'trip',
            entityId: trip.id,
            metadata: {},
          });
        }
        return { slug: null, showAmounts: false };
      });
    },
  });
}

/**
 * The public page's data, for anyone with the link (no actor). An unknown slug, a malformed one or an archived
 * trip all answer null, so nothing tells them apart.
 */
export function createSharedTrips(
  deps: Pick<Ports, 'shares' | 'trips' | 'destinations' | 'expenses' | 'savings' | 'clock'>,
) {
  return {
    async view(slug: string): Promise<SharedTripView | null> {
      if (!SHARE_SLUG.test(slug)) return null;
      const share = await deps.shares.findBySlug(slug);
      if (!share) return null;
      const trip = await deps.trips.findById(share.tripId);
      if (!trip || trip.status === 'archived') return null;
      const [stops, expenses, savings] = await Promise.all([
        deps.destinations.listByTrip(trip.id),
        deps.expenses.listByTrip(trip.id),
        deps.savings.find(trip.id),
      ]);
      const budget = budgetOf(trip, expenses, savings, deps.clock.now());
      return sharedTripSchema.parse({
        title: trip.title,
        startMonth: trip.startDate ? trip.startDate.slice(0, 7) : null,
        totalNights: stops.reduce((sum, stop) => sum + stop.nights, 0),
        stops: [...stops]
          .sort((a, b) => a.position - b.position)
          .map((stop) => ({
            name: stop.name,
            countryCode: stop.countryCode,
            nights: stop.nights,
            latitude: stop.latitude,
            longitude: stop.longitude,
          })),
        savings: {
          status: budget.savings.status,
          progressBasisPoints: budget.savings.progressBasisPoints,
          readyMonth: budget.savings.readyMonth,
        },
        amounts: share.showAmounts
          ? { total: budget.total, saved: budget.savings.saved, monthly: budget.savings.monthly }
          : null,
      });
    },
  };
}
