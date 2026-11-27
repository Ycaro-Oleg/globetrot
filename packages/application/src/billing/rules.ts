import {
  countedTrips,
  entitlements,
  overTripLimit,
  passedTripIds,
  type Entitlements,
} from '@globetrot/domain';
import type { Actor } from '../actor';
import { NotFoundError, PlanLimitError } from '../errors';
import type { BillingAccount, BillingReader, TripReader } from '../ports';

/** The account's plan facts and what they allow at `now`. An account that does not exist is "not found". */
export async function loadRights(
  billing: BillingReader,
  actor: Actor,
  now: Date,
): Promise<{ account: BillingAccount; rights: Entitlements; passed: Set<string> }> {
  const account = await billing.findAccount(actor.userId);
  if (!account) throw new NotFoundError();
  return {
    account,
    rights: entitlements({
      signedUpAt: account.signedUpAt,
      subscription: account.subscription,
      now,
    }),
    passed: passedTripIds(account.passes, now),
  };
}

/** The account's trips that count towards its plan (active, without a pass), and whether there are too many. */
export async function tripCount(
  deps: { readonly billing: BillingReader; readonly trips: TripReader },
  actor: Actor,
  now: Date,
) {
  const { rights, passed } = await loadRights(deps.billing, actor, now);
  const active = await deps.trips.listByOwner(actor.userId, { includeArchived: false });
  const counted = countedTrips(
    active.map((trip) => trip.id),
    passed,
  );
  return { rights, passed, active: active.length, counted, over: overTripLimit(rights, counted) };
}

/**
 * Throws when the account holds more counted trips than its plan keeps (after the free week, or when a plan
 * lapses): archiving trips, a pass or a plan opens it again (ADR-0023). Nothing is ever lost or hidden.
 */
export async function assertCanChange(
  deps: { readonly billing: BillingReader; readonly trips: TripReader },
  actor: Actor,
  now: Date,
) {
  const count = await tripCount(deps, actor, now);
  if (count.over) {
    throw new PlanLimitError(
      'PLAN_REQUIRED',
      `This plan keeps ${count.rights.maxActiveTrips} active trip: archive the others, add a trip pass or choose a plan`,
    );
  }
  return count.rights;
}

/** Throws when one more counted trip would pass the plan's limit. */
export async function assertTripRoom(
  deps: { readonly billing: BillingReader; readonly trips: TripReader },
  actor: Actor,
  now: Date,
) {
  const { rights, counted } = await tripCount(deps, actor, now);
  if (rights.maxActiveTrips === null) return;
  if (counted >= rights.maxActiveTrips) {
    throw new PlanLimitError(
      'TRIP_LIMIT_REACHED',
      `This plan keeps ${rights.maxActiveTrips} active trips: archive one, add a trip pass or choose a plan`,
    );
  }
}

/**
 * Commands that stay open when the account holds more trips than its plan keeps: the person can still manage
 * their account and data, archive trips, pay, leave, and keep the community safe.
 */
export const OPEN_WHEN_READ_ONLY: ReadonlySet<string> = new Set([
  'updatePreferences',
  'exportAccount',
  'deleteAccount',
  'deleteTrip',
  'archiveTrip',
  'deletePost',
  'deleteComment',
  'reportPost',
  'setMute',
  'updateHandle',
  'startCheckout',
  'openBillingPortal',
  // Stopping a public link must always work.
  'unshareTrip',
  // Joining someone else's trip, leaving it, and managing who plans one's own trip are not one's own trips.
  'acceptInvite',
  'leaveTrip',
  'removeMember',
  'revokeInvite',
  // One's own savings on a trip shared with them.
  'updateMyMoney',
  // The saving habit never stops, whatever the plan.
  'checkIn',
  // Referrals and a free pass are how an account opens again, like paying.
  'getReferral',
  'claimReferral',
  'redeemPassCredit',
]);
