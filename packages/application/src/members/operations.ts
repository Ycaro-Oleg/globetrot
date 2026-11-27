import { tripEntitlements } from '@globetrot/domain';
import { z } from 'zod';
import type { Actor } from '../actor';
import { loadRights } from '../billing/rules';
import { NotFoundError, PlanLimitError } from '../errors';
import { defineOperation } from '../operation';
import type { MemberReader, MemberRole, Ports, TripRecord, Transaction } from '../ports';
import { loadOwnedTrip, loadTripFor } from '../trips/operations';
import { toTripView, tripIdSchema, tripSchema } from '../trips/schemas';

/** How long an invite link works. */
export const INVITE_DAYS = 7;
const DAY_MS = 86_400_000;
const roleSchema = z.enum(['editor', 'viewer']);
/** The link's secret: 22 base64url characters (128 random bits). */
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

/** SHA-256 of an invite token, hex. Only the hash is stored, so reading the database joins nobody. */
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Buffer.from(digest).toString('hex');
}

/** Throws when the trip already has every guest its owner's plan (or its pass) allows. */
async function assertGuestRoom(
  deps: Pick<Ports, 'billing'> & { readonly members: MemberReader },
  trip: TripRecord,
  now: Date,
) {
  const { rights, passed } = await loadRights(
    deps.billing,
    { kind: 'user', userId: trip.ownerId },
    now,
  );
  const { guests } = tripEntitlements(rights, trip.id, passed);
  if (guests === null) return;
  if ((await deps.members.listByTrip(trip.id)).length >= guests) {
    throw new PlanLimitError(
      'GUEST_LIMIT_REACHED',
      `The free plan plans with ${guests} other person: add a trip pass or choose a plan for more`,
    );
  }
}

const memberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  role: z.enum(['owner', 'editor', 'viewer']),
  you: z.boolean().meta({ description: 'This is the caller.' }),
});
const inviteSchema = z.object({ id: z.string(), role: roleSchema, expiresAt: z.string() });

export const tripMembersSchema = z.object({
  members: z.array(memberSchema),
  invites: z
    .array(inviteSchema)
    .meta({ description: 'Open invite links; only the owner sees them.' }),
  guestLimit: z
    .number()
    .int()
    .nullable()
    .meta({ description: 'People who may join besides the owner; null for no limit.' }),
});
export const inviteCreatedSchema = z.object({
  token: z.string().meta({ description: 'The link’s secret, shown once.' }),
  role: roleSchema,
  expiresAt: z.string(),
});
export const invitePreviewSchema = z.object({
  tripTitle: z.string(),
  ownerName: z.string(),
  role: roleSchema,
  joined: z.boolean().meta({ description: 'The caller already plans this trip.' }),
  tripId: z.string(),
});
export const inviteRoleSchema = roleSchema;

/**
 * Who plans the trip: the owner first, then the members. The owner also sees the invite links still open and
 * how many guests the plan allows. Anyone who may see the trip may see who plans it.
 */
export function createGetTripMembers(
  deps: Pick<Ports, 'trips' | 'members' | 'users' | 'billing' | 'clock'>,
) {
  return defineOperation({
    name: 'getTripMembers',
    kind: 'query',
    input: z.object({ tripId: tripIdSchema }),
    output: tripMembersSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      const trip = await loadTripFor(deps.trips, actor, input.tripId, 'view');
      const [owner, members] = await Promise.all([
        deps.users.findById(trip.ownerId),
        deps.members.listByTrip(trip.id),
      ]);
      const isOwner = trip.access === 'owner';
      const { rights, passed } = await loadRights(
        deps.billing,
        { kind: 'user', userId: trip.ownerId },
        now,
      );
      return {
        members: [
          {
            userId: trip.ownerId,
            name: owner?.name ?? '',
            role: 'owner' as const,
            you: isOwner,
          },
          ...members.map((member) => ({
            userId: member.userId,
            name: member.name,
            role: member.role,
            you: member.userId === actor.userId,
          })),
        ],
        invites: isOwner
          ? (await deps.members.listOpenInvites(trip.id, now)).map((invite) => ({
              id: invite.id,
              role: invite.role,
              expiresAt: invite.expiresAt.toISOString(),
            }))
          : [],
        guestLimit: tripEntitlements(rights, trip.id, passed).guests,
      };
    },
  });
}

/**
 * A link to plan the trip together, for the owner to copy and send (Globetrot sends no email to other people).
 * The token is shown once; only its hash is kept. It works for 7 days, for as many people as the plan allows.
 */
export function createCreateInvite(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids' | 'billing'>) {
  return defineOperation({
    name: 'createInvite',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, role: roleSchema.default('editor') }),
    output: inviteCreatedSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        await assertGuestRoom({ billing: deps.billing, members: tx.members }, trip, now);
        const token = deps.ids.newToken();
        const expiresAt = new Date(now.getTime() + INVITE_DAYS * DAY_MS);
        const id = deps.ids.newId();
        await tx.members.insertInvite({
          id,
          tripId: trip.id,
          tokenHash: await hashInviteToken(token),
          role: input.role,
          createdBy: actor.userId,
          createdAt: now,
          expiresAt,
        });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.invite.create',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { role: input.role },
        });
        return { token, role: input.role, expiresAt: expiresAt.toISOString() };
      });
    },
  });
}

/** Stops an invite link for good. */
export function createRevokeInvite(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'revokeInvite',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, inviteId: z.uuid() }),
    output: z.object({ revoked: z.boolean() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
        const open = await tx.members.listOpenInvites(trip.id, now);
        if (!open.some((invite) => invite.id === input.inviteId)) throw new NotFoundError();
        await tx.members.revokeInvite(input.inviteId, now);
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.invite.revoke',
          entityType: 'trip',
          entityId: trip.id,
          metadata: {},
        });
        return { revoked: true };
      });
    },
  });
}

/** An invite that still works, with its trip; anything else is "not found". */
async function openInvite(
  reader: Pick<Transaction, 'members' | 'trips'> | Pick<Ports, 'members' | 'trips'>,
  token: string,
  now: Date,
) {
  const invite = await reader.members.findInviteByHash(await hashInviteToken(token));
  if (!invite || invite.revokedAt !== null || invite.expiresAt <= now) throw new NotFoundError();
  const trip = await reader.trips.findById(invite.tripId);
  if (!trip || trip.status === 'archived') throw new NotFoundError();
  return { invite, trip };
}

/** What an invite link opens, before accepting it: the trip's name, who invited, and the role. */
export function createPreviewInvite(deps: Pick<Ports, 'members' | 'trips' | 'users' | 'clock'>) {
  return defineOperation({
    name: 'previewInvite',
    kind: 'query',
    input: z.object({ token: tokenSchema }),
    output: invitePreviewSchema,
    async handler(actor, input) {
      const { invite, trip } = await openInvite(deps, input.token, deps.clock.now());
      const owner = await deps.users.findById(trip.ownerId);
      const joined =
        trip.ownerId === actor.userId || (await deps.trips.roleOf(trip.id, actor.userId)) !== null;
      return {
        tripTitle: trip.title,
        ownerName: owner?.name ?? '',
        role: invite.role,
        joined,
        tripId: trip.id,
      };
    },
  });
}

/** Joins the trip through an invite link. Accepting twice, or as the owner, changes nothing. */
export function createAcceptInvite(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids' | 'billing'>) {
  return defineOperation({
    name: 'acceptInvite',
    kind: 'command',
    input: z.object({ token: tokenSchema }),
    output: tripSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const { invite, trip } = await openInvite(tx, input.token, now);
        if (trip.ownerId === actor.userId) return toTripView(trip);
        const existing = await tx.trips.roleOf(trip.id, actor.userId);
        if (existing) return toTripView(trip, existing);
        await assertGuestRoom({ billing: deps.billing, members: tx.members }, trip, now);
        await tx.members.add({
          tripId: trip.id,
          userId: actor.userId,
          role: invite.role,
          joinedAt: now,
        });
        await tx.audit.record({
          id: deps.ids.newId(),
          occurredAt: now,
          actor,
          action: 'trip.member.join',
          entityType: 'trip',
          entityId: trip.id,
          metadata: { role: invite.role },
        });
        return toTripView(trip, invite.role as MemberRole);
      });
    },
  });
}

async function removeFromTrip(
  tx: Transaction,
  deps: Pick<Ports, 'ids'>,
  actor: Actor,
  tripId: string,
  userId: string,
  now: Date,
  action: 'trip.member.remove' | 'trip.member.leave',
) {
  if (!(await tx.members.remove(tripId, userId))) throw new NotFoundError();
  await tx.audit.record({
    id: deps.ids.newId(),
    occurredAt: now,
    actor,
    action,
    entityType: 'trip',
    entityId: tripId,
    metadata: {},
  });
}

/** The owner takes someone off the trip. */
export function createRemoveMember(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'removeMember',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema, userId: z.string().min(1) }),
    output: z.object({ removed: z.boolean() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        await loadOwnedTrip(tx.trips, actor, input.tripId);
        await removeFromTrip(
          tx,
          deps,
          actor,
          input.tripId,
          input.userId,
          now,
          'trip.member.remove',
        );
        return { removed: true };
      });
    },
  });
}

/** A member leaves a trip they were invited to. */
export function createLeaveTrip(deps: Pick<Ports, 'unitOfWork' | 'clock' | 'ids'>) {
  return defineOperation({
    name: 'leaveTrip',
    kind: 'command',
    input: z.object({ tripId: tripIdSchema }),
    output: z.object({ left: z.boolean() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const trip = await loadTripFor(tx.trips, actor, input.tripId, 'view');
        // The owner cannot leave their own trip: they archive or delete it.
        if (trip.access === 'owner') throw new NotFoundError();
        await removeFromTrip(tx, deps, actor, trip.id, actor.userId, now, 'trip.member.leave');
        return { left: true };
      });
    },
  });
}
