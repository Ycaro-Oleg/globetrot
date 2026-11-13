import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from './client';
import {
  account,
  auditEvent,
  checklistItem,
  commentLike,
  communityProfile,
  destination,
  expense,
  follow,
  mediaAsset,
  mute,
  post,
  postComment,
  postLike,
  postReport,
  postSave,
  trip,
  tripPlace,
  tripSavings,
  user,
  userPreference,
  visa,
} from './schema';

/**
 * The whole account, for the person's own export (LGPD/GDPR) and for deleting it. Every column is named on
 * purpose: password hashes, OAuth tokens and session tokens are never selected.
 */

type Executor = Pick<Database, 'select' | 'delete'>;

const stringify = (value: unknown): unknown =>
  typeof value === 'bigint'
    ? value.toString()
    : value instanceof Date
      ? value.toISOString()
      : Array.isArray(value)
        ? value.map(stringify)
        : value !== null && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stringify(v)]))
          : value;

export function createAccountRepository(executor: Executor) {
  return {
    /** Everything the account holds, as plain JSON values (dates as ISO strings, money as decimal strings). */
    async exportFor(userId: string) {
      const [profile] = await executor
        .select({
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.id, userId));
      if (!profile) return null;
      const trips = await executor
        .select()
        .from(trip)
        .where(eq(trip.ownerId, userId))
        .orderBy(asc(trip.createdAt));
      const tripIds = trips.map((row) => row.id);
      const byTrip = tripIds.length > 0;
      const [
        signIn,
        preferences,
        stops,
        expenses,
        savings,
        checklist,
        places,
        visas,
        community,
        posts,
        comments,
        likes,
        commentLikes,
        saves,
        follows,
        mutes,
        reports,
        media,
        history,
      ] = await Promise.all([
        executor
          .select({ provider: account.providerId, createdAt: account.createdAt })
          .from(account)
          .where(eq(account.userId, userId)),
        executor.select().from(userPreference).where(eq(userPreference.userId, userId)),
        byTrip
          ? executor
              .select()
              .from(destination)
              .where(inArray(destination.tripId, tripIds))
              .orderBy(asc(destination.tripId), asc(destination.position))
          : [],
        byTrip
          ? executor
              .select()
              .from(expense)
              .where(inArray(expense.tripId, tripIds))
              .orderBy(asc(expense.createdAt))
          : [],
        byTrip
          ? executor.select().from(tripSavings).where(inArray(tripSavings.tripId, tripIds))
          : [],
        byTrip
          ? executor
              .select()
              .from(checklistItem)
              .where(inArray(checklistItem.tripId, tripIds))
              .orderBy(asc(checklistItem.createdAt))
          : [],
        byTrip
          ? executor
              .select()
              .from(tripPlace)
              .where(inArray(tripPlace.tripId, tripIds))
              .orderBy(asc(tripPlace.tripId), asc(tripPlace.position))
          : [],
        executor.select().from(visa).where(eq(visa.userId, userId)).orderBy(asc(visa.stampedAt)),
        executor
          .select({ handle: communityProfile.handle, createdAt: communityProfile.createdAt })
          .from(communityProfile)
          .where(eq(communityProfile.userId, userId)),
        executor.select().from(post).where(eq(post.authorId, userId)).orderBy(asc(post.id)),
        executor
          .select()
          .from(postComment)
          .where(eq(postComment.authorId, userId))
          .orderBy(asc(postComment.id)),
        executor
          .select({ postId: postLike.postId, createdAt: postLike.createdAt })
          .from(postLike)
          .where(eq(postLike.userId, userId)),
        executor
          .select({ commentId: commentLike.commentId, createdAt: commentLike.createdAt })
          .from(commentLike)
          .where(eq(commentLike.userId, userId)),
        executor
          .select({ postId: postSave.postId, createdAt: postSave.createdAt })
          .from(postSave)
          .where(eq(postSave.userId, userId)),
        executor
          .select({ handle: communityProfile.handle, createdAt: follow.createdAt })
          .from(follow)
          .innerJoin(communityProfile, eq(communityProfile.userId, follow.followeeId))
          .where(eq(follow.followerId, userId)),
        executor
          .select({ handle: communityProfile.handle, createdAt: mute.createdAt })
          .from(mute)
          .innerJoin(communityProfile, eq(communityProfile.userId, mute.mutedId))
          .where(eq(mute.userId, userId)),
        executor
          .select({
            postId: postReport.postId,
            reason: postReport.reason,
            createdAt: postReport.createdAt,
          })
          .from(postReport)
          .where(eq(postReport.reporterId, userId)),
        executor
          .select()
          .from(mediaAsset)
          .where(eq(mediaAsset.ownerId, userId))
          .orderBy(asc(mediaAsset.createdAt)),
        executor
          .select({
            occurredAt: auditEvent.occurredAt,
            action: auditEvent.action,
            entityType: auditEvent.entityType,
            entityId: auditEvent.entityId,
            metadata: auditEvent.metadata,
          })
          .from(auditEvent)
          .where(and(eq(auditEvent.actorKind, 'user'), eq(auditEvent.actorId, userId)))
          .orderBy(desc(auditEvent.occurredAt))
          .limit(10000),
      ]);
      const pref = preferences[0];
      const strip = <T extends Record<string, unknown>>(row: T, ...keys: (keyof T)[]) => {
        const copy = { ...row };
        for (const key of keys) delete copy[key];
        return copy;
      };
      return stringify({
        account: { ...profile, signIn },
        preferences: pref ? strip(pref, 'userId') : null,
        trips: trips.map((row) => ({
          ...strip(row, 'ownerId'),
          stops: stops.filter((s) => s.tripId === row.id).map((s) => strip(s, 'tripId')),
          expenses: expenses.filter((e) => e.tripId === row.id).map((e) => strip(e, 'tripId')),
          savings: (() => {
            const found = savings.find((s) => s.tripId === row.id);
            return found ? strip(found, 'tripId') : null;
          })(),
          checklist: checklist.filter((c) => c.tripId === row.id).map((c) => strip(c, 'tripId')),
          dayPlaces: places.filter((p) => p.tripId === row.id).map((p) => strip(p, 'tripId')),
        })),
        visas: visas.map((row) => strip(row, 'userId')),
        community: {
          handle: community[0]?.handle ?? null,
          joinedAt: community[0]?.createdAt ?? null,
          posts: posts.map((row) => strip(row, 'authorId')),
          comments: comments.map((row) => strip(row, 'authorId')),
          likes,
          commentLikes,
          saves,
          follows,
          mutes,
          reports,
        },
        media: media.map((row) => strip(row, 'ownerId')),
        history,
      }) as Record<string, unknown>;
    },

    /** Storage keys of the account's uploads, read before the rows go. */
    async mediaIdsOf(userId: string): Promise<string[]> {
      const rows = await executor
        .select({ id: mediaAsset.id })
        .from(mediaAsset)
        .where(eq(mediaAsset.ownerId, userId));
      return rows.map((row) => row.id);
    },

    /**
     * Deletes the account: its trips first (they refuse to go with the user on purpose), then the user, which
     * cascades to sessions, sign-in methods, preferences, visas, uploads and everything in the community. The
     * audit log keeps its rows; they name an id that no longer belongs to anyone and hold no personal data.
     */
    async deleteAccount(userId: string): Promise<void> {
      await executor.delete(trip).where(eq(trip.ownerId, userId));
      await executor.delete(user).where(eq(user.id, userId));
    },

    /** A trip and everything in it (cascade). Only an archived trip of the owner. */
    async deleteArchivedTrip(tripId: string, ownerId: string): Promise<boolean> {
      const rows = await executor
        .delete(trip)
        .where(and(eq(trip.id, tripId), eq(trip.ownerId, ownerId), eq(trip.status, 'archived')))
        .returning({ id: trip.id });
      return rows.length > 0;
    },
  };
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
