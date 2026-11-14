import { TOP_UP } from '@globetrot/domain';
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
    };

export type PaymentOutcome = 'applied' | 'duplicate' | 'unknown-account';

/** Records plans and bought credits from the provider. Not an operation: no person is acting, the provider is. */
export function createPaymentEvents(
  deps: Pick<Ports, 'users' | 'billing' | 'unitOfWork' | 'clock' | 'ids'>,
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
