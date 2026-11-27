import { addDays, TOP_UP, toLocalDate, tripPassValidUntil } from '@globetrot/domain';
import type { Ports, SubscriptionRecord } from '../ports';

/**
 * What the payment provider told us, already verified and translated by its adapter (ADR-0019). The adapter
 * reads the subscription's current state from the provider on every event, so applying one is "make ours match
 * theirs": safe to repeat and safe out of order.
 */
export type PaymentEvent =
  | {
      readonly kind: 'subscription';
      /** From the checkout or the subscription's metadata; null to find it by the provider's subscription id. */
      readonly userId: string | null;
      readonly record: SubscriptionRecord;
    }
  | {
      readonly kind: 'top-up';
      readonly userId: string;
      /** The provider's payment id: a top-up is applied once per payment. */
      readonly paymentId: string;
    }
  | {
      readonly kind: 'trip-pass';
      readonly userId: string;
      readonly tripId: string;
      /** The provider's payment id: a pass is granted once per payment. */
      readonly paymentId: string;
    };

export type PaymentOutcome = 'applied' | 'duplicate' | 'unknown-account';

/** The day the trip ends (the start plus every night), or null while it has no start date. */
async function tripEndsOn(
  deps: Pick<Ports, 'destinations'>,
  trip: { readonly id: string; readonly startDate: string | null },
): Promise<Date | null> {
  if (!trip.startDate) return null;
  const stops = await deps.destinations.listByTrip(trip.id);
  const nights = stops.reduce((sum, stop) => sum + stop.nights, 0);
  return new Date(`${addDays(toLocalDate(trip.startDate), nights)}T00:00:00.000Z`);
}

/**
 * Records plans, bought credits and trip passes from the provider. Not an operation: no person is acting, the
 * provider is.
 */
export function createPaymentEvents(
  deps: Pick<
    Ports,
    'users' | 'billing' | 'trips' | 'destinations' | 'unitOfWork' | 'clock' | 'ids'
  >,
) {
  return {
    async apply(event: PaymentEvent): Promise<PaymentOutcome> {
      const now = deps.clock.now();
      const userId =
        event.kind === 'subscription' && event.userId === null
          ? event.record.providerSubscriptionId
            ? await deps.billing.findUserByProviderSubscription(event.record.providerSubscriptionId)
            : null
          : event.userId;
      if (!userId || !(await deps.users.findById(userId))) return 'unknown-account';
      const actor = { kind: 'user' as const, userId };

      return deps.unitOfWork.run(async (tx) => {
        if (event.kind === 'subscription') {
          await tx.billing.saveSubscription(userId, event.record, now);
          await tx.audit.record({
            id: deps.ids.newId(),
            occurredAt: now,
            actor,
            action: 'billing.subscription',
            entityType: 'account',
            entityId: userId,
            metadata: {
              plan: event.record.plan,
              interval: event.record.interval,
              status: event.record.status,
            },
          });
          return 'applied';
        }
        if (event.kind === 'trip-pass') {
          const trip = await tx.trips.findById(event.tripId);
          // A pass is for the buyer's own trip; anything else is not applied (and not revealed).
          if (!trip || trip.ownerId !== userId) return 'unknown-account';
          const validUntil = tripPassValidUntil(now, await tripEndsOn(deps, trip));
          const granted = await tx.billing.grantTripPass({
            id: deps.ids.newId(),
            tripId: trip.id,
            userId,
            purchasedAt: now,
            validUntil,
            providerRef: event.paymentId,
          });
          if (!granted) return 'duplicate';
          await tx.audit.record({
            id: deps.ids.newId(),
            occurredAt: now,
            actor,
            action: 'billing.trip-pass',
            entityType: 'trip',
            entityId: trip.id,
            metadata: { validUntil: validUntil.toISOString().slice(0, 10) },
          });
          return 'applied';
        }
        const added = await tx.billing.addCredits({
          id: deps.ids.newId(),
          userId,
          delta: TOP_UP.credits,
          reason: 'top-up',
          ref: event.paymentId,
          createdAt: now,
        });
        if (!added) return 'duplicate';
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'billing.top-up',
          entityType: 'account',
          entityId: userId,
          metadata: { credits: TOP_UP.credits },
        });
        return 'applied';
      });
    },
  };
}

export type PaymentEvents = ReturnType<typeof createPaymentEvents>;
