import { tripPassValidUntil } from '@globetrot/domain';
import { z } from 'zod';
import { NotFoundError } from '../errors';
import { defineOperation } from '../operation';
import type { Ports } from '../ports';
import { loadOwnedTrip } from '../trips/operations';
import { tripIdSchema } from '../trips/schemas';
import { tripEndsOn } from './payment-events';

/** A new account can still say who sent it for this long after signing up. */
export const REFERRAL_CLAIM_DAYS = 7;
const DAY_MS = 86_400_000;
const codeSchema = z.string().regex(/^[A-Za-z0-9]{6,12}$/);

export const referralSchema = z.object({
  /** The person's code: their link is the site with `?ref={code}`. */
  code: z.string(),
  /** Accounts that came through the link. */
  joined: z.number().int(),
  /** Free trip passes earned and not used yet. */
  passCredits: z.number().int(),
});

/**
 * The person's referral link and what it earned (ADR-0029). A command because the code is made the first time
 * it is asked for.
 */
export function createGetReferral(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'getReferral',
    kind: 'command',
    input: z.object({}),
    output: referralSchema,
    async handler(actor) {
      const now = deps.clock.now();
      // Eight letters and digits from 128 random bits: short enough to say, far from guessable.
      const candidate = deps.ids
        .newToken()
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 8)
        .toUpperCase();
      return deps.unitOfWork.run(async (tx) => {
        const code = await tx.billing.ensureReferralCode(actor.userId, candidate, now);
        const [joined, account] = await Promise.all([
          tx.billing.countReferrals(actor.userId),
          tx.billing.findAccount(actor.userId),
        ]);
        return { code, joined, passCredits: account?.passCredits ?? 0 };
      });
    },
  });
}

/**
 * Records who sent a new account (from the link's code kept since the visit). Only within the first days, never
 * oneself, once. An unknown code changes nothing and says so without telling whether codes exist.
 */
export function createClaimReferral(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'claimReferral',
    kind: 'command',
    input: z.object({ code: codeSchema }),
    output: z.object({ claimed: z.boolean() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const [referrer, account] = await Promise.all([
          tx.billing.findReferrer(input.code.toUpperCase()),
          tx.billing.findAccount(actor.userId),
        ]);
        const recent =
          account !== null &&
          now.getTime() - account.signedUpAt.getTime() <= REFERRAL_CLAIM_DAYS * DAY_MS;
        if (!referrer || referrer === actor.userId || !recent) return { claimed: false };
        const claimed = await tx.billing.claimReferral(actor.userId, referrer, now);
        if (claimed) {
          await tx.audit.record({
            id: deps.ids.newId(),
            occurredAt: now,
            actor,
            action: 'billing.referral-claim',
            entityType: 'account',
            entityId: actor.userId,
            metadata: {},
          });
        }
        return { claimed };
      });
    },
  });
}

/** Uses a free pass earned by referring a friend on one of the person's own trips. */
export function createRedeemPassCredit(
  deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids' | 'destinations'>,
) {
  return defineOperation({
    name: 'redeemPassCredit',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema }),
    output: z.object({ validUntil: z.string() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        const creditId = await tx.billing.useCredit(actor.userId, trip.id, now);
        if (!creditId) throw new NotFoundError('No free trip pass left');
        const validUntil = tripPassValidUntil(now, await tripEndsOn(deps, trip));
        await tx.billing.grantTripPass({
          id: deps.ids.newId(),
          tripId: trip.id,
          userId: actor.userId,
          purchasedAt: now,
          validUntil,
          providerRef: `credit:${creditId}`,
        });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'billing.trip-pass',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { validUntil: validUntil.toISOString().slice(0, 10), free: true },
        });
        return { validUntil: validUntil.toISOString() };
      });
    },
  });
}
