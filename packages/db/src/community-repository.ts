import type { PostAudience, PostKind, ReportReason } from '@globetrot/domain';
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { Database } from './client';
import {
  commentLike,
  communityProfile,
  follow,
  mute,
  post,
  postComment,
  postLike,
  postReport,
  postSave,
  user,
  userPreference,
  type PhotoRef,
  type PostAttachment,
} from './schema';

/**
 * PostgreSQL adapter for the application's community port (packages/application/src/ports.ts). The feed applies
 * the same visibility rule as `canSeePost` in @globetrot/domain; the integration tests hold the two together.
 */

type Executor = Pick<Database, 'select' | 'selectDistinctOn' | 'insert' | 'update' | 'delete'>;

export interface PostRow {
  readonly id: string;
  readonly authorId: string;
  readonly kind: PostKind;
  readonly body: string;
  readonly placeName: string | null;
  readonly placeCountry: string | null;
  readonly audience: PostAudience;
  readonly attachment: PostAttachment | null;
  readonly photos: readonly PhotoRef[];
  readonly createdAt: Date;
  readonly editedAt: Date | null;
  readonly deletedAt: Date | null;
  readonly hiddenAt: Date | null;
}

export interface CommentRow {
  readonly id: string;
  readonly postId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
}

const asPost = (row: typeof post.$inferSelect): PostRow => ({
  ...row,
  kind: row.kind as PostKind,
  audience: row.audience as PostAudience,
  placeCountry: row.placeCountry,
  attachment: row.attachment ?? null,
});

const followsAuthor = (viewerId: string): SQL =>
  sql`exists (select 1 from ${follow} where ${follow.followerId} = ${viewerId} and ${follow.followeeId} = ${post.authorId})`;

/** `canSeePost` in SQL: the author sees their own; others need it public or followed, and not hidden to them. */
const visibleTo = (viewerId: string): SQL =>
  sql`${post.deletedAt} is null and (${post.authorId} = ${viewerId} or (
    ${post.hiddenAt} is null
    and not exists (select 1 from ${mute} where ${mute.userId} = ${viewerId} and ${mute.mutedId} = ${post.authorId})
    and not exists (select 1 from ${postReport} where ${postReport.postId} = ${post.id} and ${postReport.reporterId} = ${viewerId})
    and (${post.audience} = 'everyone' or ${followsAuthor(viewerId)})
  ))`;

/** Public, live posts: what suggestions and trending count. */
const publicPost = (since: Date): SQL =>
  and(
    eq(post.audience, 'everyone'),
    isNull(post.deletedAt),
    isNull(post.hiddenAt),
    gte(post.createdAt, since),
  )!;

export function createCommunityRepository(executor: Executor) {
  const toggle = async <T>(on: boolean, insert: () => Promise<T>, remove: () => Promise<T>) => {
    await (on ? insert() : remove());
  };

  return {
    async findProfile(userId: string) {
      const [row] = await executor
        .select({ userId: communityProfile.userId, handle: communityProfile.handle })
        .from(communityProfile)
        .where(eq(communityProfile.userId, userId));
      return row ?? null;
    },
    async findProfileByHandle(handle: string) {
      const [row] = await executor
        .select({ userId: communityProfile.userId, handle: communityProfile.handle })
        .from(communityProfile)
        .where(eq(communityProfile.handle, handle));
      return row ?? null;
    },
    async people(userIds: readonly string[]) {
      if (userIds.length === 0) return [];
      const rows = await executor
        .select({
          userId: communityProfile.userId,
          handle: communityProfile.handle,
          name: user.name,
          hat: userPreference.pipHat,
          outfit: userPreference.pipOutfit,
          bag: userPreference.pipBag,
          bagColor: userPreference.pipBagColor,
        })
        .from(communityProfile)
        .innerJoin(user, eq(user.id, communityProfile.userId))
        .leftJoin(userPreference, eq(userPreference.userId, communityProfile.userId))
        .where(inArray(communityProfile.userId, [...userIds]));
      return rows.map(({ hat, outfit, bag, bagColor, ...person }) => ({
        ...person,
        pipLook: hat && outfit && bag && bagColor ? { hat, outfit, bag, bagColor } : null,
      }));
    },
    async feed(input: {
      readonly viewerId: string;
      readonly scope:
        | { readonly kind: 'all' }
        | { readonly kind: 'following' }
        | { readonly kind: 'author'; readonly authorId: string };
      readonly before?: string | undefined;
      readonly limit: number;
    }): Promise<PostRow[]> {
      const conditions: SQL[] = [visibleTo(input.viewerId)];
      if (input.scope.kind === 'following') {
        conditions.push(
          sql`(${post.authorId} = ${input.viewerId} or ${followsAuthor(input.viewerId)})`,
        );
      }
      if (input.scope.kind === 'author') conditions.push(eq(post.authorId, input.scope.authorId));
      if (input.before) conditions.push(lt(post.id, input.before));
      const rows = await executor
        .select()
        .from(post)
        .where(and(...conditions))
        .orderBy(desc(post.id))
        .limit(input.limit);
      return rows.map(asPost);
    },
    /** Live posts that show this image (deleted ones do not count). */
    async postsWithMedia(mediaId: string): Promise<PostRow[]> {
      const rows = await executor
        .select()
        .from(post)
        .where(
          and(
            isNull(post.deletedAt),
            sql`${post.photos} @> ${JSON.stringify([{ mediaId }])}::jsonb`,
          ),
        )
        .limit(20);
      return rows.map(asPost);
    },
    async findPost(id: string) {
      const [row] = await executor.select().from(post).where(eq(post.id, id));
      return row ? asPost(row) : null;
    },
    async relations(viewerId: string, userIds: readonly string[]) {
      if (userIds.length === 0) return { following: new Set<string>(), muted: new Set<string>() };
      const [followed, muted] = await Promise.all([
        executor
          .select({ id: follow.followeeId })
          .from(follow)
          .where(and(eq(follow.followerId, viewerId), inArray(follow.followeeId, [...userIds]))),
        executor
          .select({ id: mute.mutedId })
          .from(mute)
          .where(and(eq(mute.userId, viewerId), inArray(mute.mutedId, [...userIds]))),
      ]);
      return {
        following: new Set(followed.map((row) => row.id)),
        muted: new Set(muted.map((row) => row.id)),
      };
    },
    async hasReported(viewerId: string, postId: string) {
      const [row] = await executor
        .select({ postId: postReport.postId })
        .from(postReport)
        .where(and(eq(postReport.postId, postId), eq(postReport.reporterId, viewerId)));
      return row !== undefined;
    },
    async stats(viewerId: string, postIds: readonly string[]) {
      const result = new Map<
        string,
        { likes: number; liked: boolean; saved: boolean; comments: number; likedBy: string | null }
      >();
      if (postIds.length === 0) return result;
      const ids = [...postIds];
      const [likes, liked, saved, comments, likedBy] = await Promise.all([
        executor
          .select({ postId: postLike.postId, n: count() })
          .from(postLike)
          .where(inArray(postLike.postId, ids))
          .groupBy(postLike.postId),
        executor
          .select({ postId: postLike.postId })
          .from(postLike)
          .where(and(inArray(postLike.postId, ids), eq(postLike.userId, viewerId))),
        executor
          .select({ postId: postSave.postId })
          .from(postSave)
          .where(and(inArray(postSave.postId, ids), eq(postSave.userId, viewerId))),
        executor
          .select({ postId: postComment.postId, n: count() })
          .from(postComment)
          .where(and(inArray(postComment.postId, ids), isNull(postComment.deletedAt)))
          .groupBy(postComment.postId),
        executor
          .selectDistinctOn([postLike.postId], {
            postId: postLike.postId,
            userId: postLike.userId,
          })
          .from(postLike)
          .innerJoin(
            follow,
            and(eq(follow.followeeId, postLike.userId), eq(follow.followerId, viewerId)),
          )
          .where(inArray(postLike.postId, ids))
          .orderBy(postLike.postId, desc(postLike.createdAt)),
      ]);
      const likedSet = new Set(liked.map((row) => row.postId));
      const savedSet = new Set(saved.map((row) => row.postId));
      for (const id of ids) {
        result.set(id, {
          likes: likes.find((row) => row.postId === id)?.n ?? 0,
          liked: likedSet.has(id),
          saved: savedSet.has(id),
          comments: comments.find((row) => row.postId === id)?.n ?? 0,
          likedBy: likedBy.find((row) => row.postId === id)?.userId ?? null,
        });
      }
      return result;
    },
    async comments(viewerId: string, postId: string) {
      const rows = await executor
        .select({
          id: postComment.id,
          postId: postComment.postId,
          authorId: postComment.authorId,
          body: postComment.body,
          createdAt: postComment.createdAt,
          deletedAt: postComment.deletedAt,
          likes: sql<number>`(select count(*)::int from ${commentLike} where ${commentLike.commentId} = ${postComment.id})`,
          liked: sql<boolean>`exists (select 1 from ${commentLike} where ${commentLike.commentId} = ${postComment.id} and ${commentLike.userId} = ${viewerId})`,
        })
        .from(postComment)
        .where(
          and(
            eq(postComment.postId, postId),
            isNull(postComment.deletedAt),
            sql`not exists (select 1 from ${mute} where ${mute.userId} = ${viewerId} and ${mute.mutedId} = ${postComment.authorId})`,
          ),
        )
        .orderBy(asc(postComment.id))
        .limit(200);
      return rows;
    },
    async findComment(id: string): Promise<CommentRow | null> {
      const [row] = await executor.select().from(postComment).where(eq(postComment.id, id));
      return row ?? null;
    },
    async suggestions(viewerId: string, since: Date, limit: number) {
      return executor
        .select({ userId: post.authorId, posts: count() })
        .from(post)
        .where(
          and(
            publicPost(since),
            sql`${post.authorId} <> ${viewerId}`,
            sql`not ${followsAuthor(viewerId)}`,
            sql`not exists (select 1 from ${mute} where ${mute.userId} = ${viewerId} and ${mute.mutedId} = ${post.authorId})`,
          ),
        )
        .groupBy(post.authorId)
        .orderBy(desc(count()), desc(sql`max(${post.createdAt})`))
        .limit(limit);
    },
    async trending(since: Date, limit: number) {
      const rows = await executor
        .select({ countryCode: post.placeCountry, posts: count() })
        .from(post)
        .where(and(publicPost(since), sql`${post.placeCountry} is not null`))
        .groupBy(post.placeCountry)
        .orderBy(desc(count()), asc(post.placeCountry))
        .limit(limit);
      return rows.map((row) => ({ countryCode: row.countryCode!, posts: row.posts }));
    },
    async personStats(userId: string) {
      const [[posts], [followers], [following]] = await Promise.all([
        executor
          .select({ n: count() })
          .from(post)
          .where(and(eq(post.authorId, userId), isNull(post.deletedAt), isNull(post.hiddenAt))),
        executor.select({ n: count() }).from(follow).where(eq(follow.followeeId, userId)),
        executor.select({ n: count() }).from(follow).where(eq(follow.followerId, userId)),
      ]);
      return { posts: posts?.n ?? 0, followers: followers?.n ?? 0, following: following?.n ?? 0 };
    },
    async countPostsSince(authorId: string, since: Date) {
      const [row] = await executor
        .select({ n: count() })
        .from(post)
        .where(and(eq(post.authorId, authorId), gte(post.createdAt, since)));
      return row?.n ?? 0;
    },
    async countCommentsSince(authorId: string, since: Date) {
      const [row] = await executor
        .select({ n: count() })
        .from(postComment)
        .where(and(eq(postComment.authorId, authorId), gte(postComment.createdAt, since)));
      return row?.n ?? 0;
    },

    // --- Writes ---
    async createProfile(userId: string, handle: string, now: Date) {
      const rows = await executor
        .insert(communityProfile)
        .values({ userId, handle, createdAt: now })
        .onConflictDoNothing()
        .returning({ userId: communityProfile.userId });
      return rows.length > 0;
    },
    async updateHandle(userId: string, handle: string) {
      const taken = await executor
        .select({ userId: communityProfile.userId })
        .from(communityProfile)
        .where(eq(communityProfile.handle, handle));
      if (taken.some((row) => row.userId !== userId)) return false;
      await executor
        .update(communityProfile)
        .set({ handle })
        .where(eq(communityProfile.userId, userId));
      return true;
    },
    async insertPost(row: Omit<PostRow, 'editedAt' | 'deletedAt' | 'hiddenAt'>) {
      await executor.insert(post).values({ ...row, photos: [...row.photos] });
    },
    async updatePost(
      id: string,
      patch: {
        readonly body?: string;
        readonly editedAt?: Date;
        readonly deletedAt?: Date | null;
        readonly hiddenAt?: Date | null;
      },
    ) {
      await executor.update(post).set(patch).where(eq(post.id, id));
    },
    async setLike(postId: string, userId: string, on: boolean, now: Date) {
      await toggle(
        on,
        () =>
          executor
            .insert(postLike)
            .values({ postId, userId, createdAt: now })
            .onConflictDoNothing(),
        () =>
          executor
            .delete(postLike)
            .where(and(eq(postLike.postId, postId), eq(postLike.userId, userId))),
      );
    },
    async setSave(postId: string, userId: string, on: boolean, now: Date) {
      await toggle(
        on,
        () =>
          executor
            .insert(postSave)
            .values({ postId, userId, createdAt: now })
            .onConflictDoNothing(),
        () =>
          executor
            .delete(postSave)
            .where(and(eq(postSave.postId, postId), eq(postSave.userId, userId))),
      );
    },
    async setCommentLike(commentId: string, userId: string, on: boolean, now: Date) {
      await toggle(
        on,
        () =>
          executor
            .insert(commentLike)
            .values({ commentId, userId, createdAt: now })
            .onConflictDoNothing(),
        () =>
          executor
            .delete(commentLike)
            .where(and(eq(commentLike.commentId, commentId), eq(commentLike.userId, userId))),
      );
    },
    async insertComment(row: Omit<CommentRow, 'deletedAt'>) {
      await executor.insert(postComment).values(row);
    },
    async setCommentDeleted(id: string, deletedAt: Date | null) {
      await executor.update(postComment).set({ deletedAt }).where(eq(postComment.id, id));
    },
    async setFollow(followerId: string, followeeId: string, on: boolean, now: Date) {
      await toggle(
        on,
        () =>
          executor
            .insert(follow)
            .values({ followerId, followeeId, createdAt: now })
            .onConflictDoNothing(),
        () =>
          executor
            .delete(follow)
            .where(and(eq(follow.followerId, followerId), eq(follow.followeeId, followeeId))),
      );
    },
    async setMute(userId: string, mutedId: string, on: boolean, now: Date) {
      await toggle(
        on,
        () =>
          executor.insert(mute).values({ userId, mutedId, createdAt: now }).onConflictDoNothing(),
        () => executor.delete(mute).where(and(eq(mute.userId, userId), eq(mute.mutedId, mutedId))),
      );
    },
    async report(postId: string, reporterId: string, reason: ReportReason, now: Date) {
      await executor
        .insert(postReport)
        .values({ postId, reporterId, reason, createdAt: now })
        .onConflictDoNothing();
      const [row] = await executor
        .select({ n: count() })
        .from(postReport)
        .where(eq(postReport.postId, postId));
      return row?.n ?? 0;
    },
  };
}

export type CommunityRepository = ReturnType<typeof createCommunityRepository>;
