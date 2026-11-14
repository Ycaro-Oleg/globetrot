import { entitlements, type Entitlements } from '@globetrot/domain';
import type { Actor } from '../actor';
import { NotFoundError, PlanLimitError } from '../errors';
import type { BillingAccount, BillingReader, TripReader } from '../ports';

/** The account's plan facts and what they allow at `now`. An account that does not exist is "not found". */
export async function loadRights(
  billing: BillingReader,
  actor: Actor,
  now: Date,
): Promise<{ account: BillingAccount; rights: Entitlements }> {
  const account = await billing.findAccount(actor.userId);
  if (!account) throw new NotFoundError();
  return {
    account,
    rights: entitlements({
      signedUpAt: account.signedUpAt,
      subscription: account.subscription,
      now,
    }),
  };
}

/** Throws unless the account may change things (in the trial or on a plan). */
export async function assertCanChange(billing: BillingReader, actor: Actor, now: Date) {
  const { rights } = await loadRights(billing, actor, now);
  if (rights.readOnly) {
    throw new PlanLimitError('PLAN_REQUIRED', 'The trial is over: choose a plan to keep planning');
  }
  return rights;
}

/** Throws when one more active (not archived) trip would pass the plan's limit. */
export async function assertTripRoom(
  deps: { readonly billing: BillingReader; readonly trips: TripReader },
  actor: Actor,
  now: Date,
) {
  const { rights } = await loadRights(deps.billing, actor, now);
  if (rights.maxActiveTrips === null) return;
  const active = await deps.trips.listByOwner(actor.userId, { includeArchived: false });
  if (active.length >= rights.maxActiveTrips) {
    throw new PlanLimitError(
      'TRIP_LIMIT_REACHED',
      `This plan keeps ${rights.maxActiveTrips} active trips: archive one or move to Voyager`,
    );
  }
}

/**
 * Commands that stay open when the account is read-only: the person can still manage their account and data,
 * leave, and keep the community safe. Everything else that changes something needs the trial or a plan.
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
]);
