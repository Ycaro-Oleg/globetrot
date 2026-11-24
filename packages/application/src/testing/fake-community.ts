import { canSeePost } from '@globetrot/domain';
import type {
  CommentRecord,
  CommunityWriter,
  PostRecord,
  PreferencesRecord,
  UserRecord,
} from '../ports';

/** In-memory community, applying the same `canSeePost` rule the database applies to feeds. */
export interface FakeCommunityState {
  profiles: Map<string, string>;
  posts: Map<string, PostRecord>;
  comments: Map<string, CommentRecord>;
  likes: Map<string, Date>;
  saves: Set<string>;
  commentLikes: Set<string>;
  follows: Set<string>;
  mutes: Set<string>;
  reports: Set<string>;
}

const pair = (a: string, b: string) => `${a}\u0000${b}`;

export function emptyCommunityState(): FakeCommunityState {
  return {
    profiles: new Map(),
    posts: new Map(),
    comments: new Map(),
    likes: new Map(),
    saves: new Set(),
    commentLikes: new Set(),
    follows: new Set(),
    mutes: new Set(),
    reports: new Set(),
  };
}

export function createFakeCommunity(
  get: () => FakeCommunityState,
  users: () => readonly UserRecord[],
  preferences: () => Map<string, PreferencesRecord>,
): CommunityWriter {
  const visible = (viewerId: string, post: PostRecord) =>
    canSeePost(
      {
        authorId: post.authorId,
        audience: post.audience,
        deleted: post.deletedAt !== null,
        hidden: post.hiddenAt !== null,
      },
      {
        viewerId,
        follows: get().follows.has(pair(viewerId, post.authorId)),
        muted: get().mutes.has(pair(viewerId, post.authorId)),
        reported: get().reports.has(pair(post.id, viewerId)),
      },
    );
  const toggle = (set: Set<string>, key: string, on: boolean) => {
    if (on) set.add(key);
    else set.delete(key);
  };

  return {
    async findProfile(userId) {
      const handle = get().profiles.get(userId);
      return handle ? { userId, handle } : null;
    },
    async findProfileByHandle(handle) {
      for (const [userId, value] of get().profiles) {
        if (value === handle) return { userId, handle };
      }
      return null;
    },
    async people(userIds) {
      return userIds.flatMap((userId) => {
        const handle = get().profiles.get(userId);
        const user = users().find((candidate) => candidate.id === userId);
        if (!handle || !user) return [];
        return [
          {
            userId,
            handle,
            name: user.name,
            pipLook: preferences().get(userId)?.pipLook ?? null,
          },
        ];
      });
    },
    async feed({ viewerId, scope, before, limit }) {
      return [...get().posts.values()]
        .filter((post) => visible(viewerId, post))
        .filter((post) =>
          scope.kind === 'following'
            ? post.authorId === viewerId || get().follows.has(pair(viewerId, post.authorId))
            : scope.kind === 'author'
              ? post.authorId === scope.authorId
              : true,
        )
        .filter((post) => before === undefined || post.id < before)
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .slice(0, limit);
    },
    async postsWithMedia(mediaId) {
      return [...get().posts.values()].filter(
        (post) => !post.deletedAt && post.photos.some((photo) => photo.mediaId === mediaId),
      );
    },
    async findPost(id) {
      return get().posts.get(id) ?? null;
    },
    async relations(viewerId, userIds) {
      return {
        following: new Set(userIds.filter((id) => get().follows.has(pair(viewerId, id)))),
        muted: new Set(userIds.filter((id) => get().mutes.has(pair(viewerId, id)))),
      };
    },
    async hasReported(viewerId, postId) {
      return get().reports.has(pair(postId, viewerId));
    },
    async stats(viewerId, postIds) {
      const result = new Map();
      for (const id of postIds) {
        const likers = [...get().likes.keys()]
          .filter((key) => key.startsWith(`${id}\u0000`))
          .map((key) => key.split('\u0000')[1]!);
        result.set(id, {
          likes: likers.length,
          liked: likers.includes(viewerId),
          saved: get().saves.has(pair(id, viewerId)),
          comments: [...get().comments.values()].filter((c) => c.postId === id && !c.deletedAt)
            .length,
          likedBy: likers.find((liker) => get().follows.has(pair(viewerId, liker))) ?? null,
        });
      }
      return result;
    },
    async comments(viewerId, postId) {
      return [...get().comments.values()]
        .filter(
          (c) =>
            c.postId === postId && !c.deletedAt && !get().mutes.has(pair(viewerId, c.authorId)),
        )
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map((c) => {
          const likers = [...get().commentLikes].filter((key) => key.startsWith(`${c.id}\u0000`));
          return {
            ...c,
            likes: likers.length,
            liked: get().commentLikes.has(pair(c.id, viewerId)),
          };
        });
    },
    async findComment(id) {
      return get().comments.get(id) ?? null;
    },
    async suggestions(viewerId, since, limit) {
      const counts = new Map<string, number>();
      for (const post of get().posts.values()) {
        if (post.audience !== 'everyone' || post.deletedAt || post.hiddenAt) continue;
        if (post.createdAt < since || post.authorId === viewerId) continue;
        if (get().follows.has(pair(viewerId, post.authorId))) continue;
        if (get().mutes.has(pair(viewerId, post.authorId))) continue;
        counts.set(post.authorId, (counts.get(post.authorId) ?? 0) + 1);
      }
      return [...counts]
        .map(([userId, posts]) => ({ userId, posts }))
        .sort((a, b) => b.posts - a.posts)
        .slice(0, limit);
    },
    async trending(since, limit) {
      const counts = new Map<string, number>();
      for (const post of get().posts.values()) {
        if (post.audience !== 'everyone' || post.deletedAt || post.hiddenAt) continue;
        if (post.createdAt < since || !post.placeCountry) continue;
        counts.set(post.placeCountry, (counts.get(post.placeCountry) ?? 0) + 1);
      }
      return [...counts]
        .map(([countryCode, posts]) => ({ countryCode, posts }))
        .sort((a, b) => b.posts - a.posts || a.countryCode.localeCompare(b.countryCode))
        .slice(0, limit);
    },
    async personStats(userId) {
      return {
        posts: [...get().posts.values()].filter(
          (p) => p.authorId === userId && !p.deletedAt && !p.hiddenAt,
        ).length,
        followers: [...get().follows].filter((key) => key.endsWith(`\u0000${userId}`)).length,
        following: [...get().follows].filter((key) => key.startsWith(`${userId}\u0000`)).length,
      };
    },
    async countPostsSince(authorId, since) {
      return [...get().posts.values()].filter(
        (p) => p.authorId === authorId && p.createdAt >= since,
      ).length;
    },
    async countCommentsSince(authorId, since) {
      return [...get().comments.values()].filter(
        (c) => c.authorId === authorId && c.createdAt >= since,
      ).length;
    },
    async createProfile(userId, handle) {
      if (get().profiles.has(userId)) return false;
      if ([...get().profiles.values()].includes(handle)) return false;
      get().profiles.set(userId, handle);
      return true;
    },
    async updateHandle(userId, handle) {
      for (const [other, value] of get().profiles) {
        if (value === handle && other !== userId) return false;
      }
      get().profiles.set(userId, handle);
      return true;
    },
    async insertPost(post) {
      get().posts.set(post.id, { ...post, editedAt: null, deletedAt: null, hiddenAt: null });
    },
    async updatePost(id, patch) {
      const post = get().posts.get(id);
      if (post) get().posts.set(id, { ...post, ...patch });
    },
    async setLike(postId, userId, on, now) {
      if (on) get().likes.set(pair(postId, userId), now);
      else get().likes.delete(pair(postId, userId));
    },
    async setSave(postId, userId, on) {
      toggle(get().saves, pair(postId, userId), on);
    },
    async setCommentLike(commentId, userId, on) {
      toggle(get().commentLikes, pair(commentId, userId), on);
    },
    async insertComment(comment) {
      get().comments.set(comment.id, { ...comment, deletedAt: null });
    },
    async setCommentDeleted(id, deletedAt) {
      const comment = get().comments.get(id);
      if (comment) get().comments.set(id, { ...comment, deletedAt });
    },
    async setFollow(followerId, followeeId, on) {
      toggle(get().follows, pair(followerId, followeeId), on);
    },
    async setMute(userId, mutedId, on) {
      toggle(get().mutes, pair(userId, mutedId), on);
    },
    async report(postId, reporterId) {
      get().reports.add(pair(postId, reporterId));
      return [...get().reports].filter((key) => key.startsWith(`${postId}\u0000`)).length;
    },
  };
}
