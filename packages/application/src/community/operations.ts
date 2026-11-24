import { assertTripRoom } from '../billing/rules';
import {
  canSeePost,
  COMMENTS_PER_DAY,
  DEFAULT_CURRENCY,
  DEFAULT_TRIP_STATUS,
  DEFAULT_TRIP_VISIBILITY,
  handleFromName,
  needsBody,
  POSTS_PER_DAY,
  REPORTS_TO_HIDE,
  toPipLook,
} from '@globetrot/domain';
import { z } from 'zod';
import type { Actor } from '../actor';
import { budgetOf } from '../budget/operations';
import { ownedPhotos } from '../media/operations';
import { canonicalJson } from '../canonical-json';
import {
  IdempotencyKeyReusedError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from '../errors';
import { defineOperation } from '../operation';
import type {
  AuditMetadata,
  CommentRecord,
  CommunityReader,
  TripReader,
  PersonRecord,
  PostAttachmentRecord,
  PostRecord,
  Ports,
  Transaction,
} from '../ports';
import { idempotencyKeySchema, loadOwnedTrip } from '../trips/operations';
import { toTripView, tripSchema } from '../trips/schemas';
import {
  commentFields,
  commentListSchema,
  communityMeSchema,
  createPostFields,
  discoverSchema,
  feedQuery,
  feedSchema,
  handleSchema,
  personPageSchema,
  postSchema,
  reportFields,
  toggleFields,
  updateHandleFields,
  updatePostFields,
  type CommentView,
  type PersonView,
  type PostView,
} from './schemas';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back "who to follow" and "trending" look. */
const DISCOVER_DAYS = 30;

function invalid(field: string, code: string, message: string): never {
  throw new ValidationError([{ field, code, message }]);
}

const personView = (person: PersonRecord): PersonView => ({
  handle: person.handle,
  name: person.name,
  pipLook: toPipLook(person.pipLook),
});

/** A stored snapshot as clients read it: coordinates and place keys stay on the server. */
function attachmentView(attachment: PostAttachmentRecord | null): PostView['attachment'] {
  if (!attachment) return null;
  if (attachment.kind === 'route') {
    return {
      kind: 'route',
      title: attachment.title,
      nights: attachment.nights,
      stops: attachment.stops.map((stop) => ({
        name: stop.name,
        countryCode: stop.countryCode,
        nights: stop.nights,
      })),
      total: attachment.total,
    };
  }
  return attachment;
}

/**
 * Turns stored posts into what this viewer reads: author, counts, their own likes and saves, and their copy of a
 * shared route.
 */
async function postViews(
  ports: { readonly community: CommunityReader; readonly trips: Pick<TripReader, 'copiesOf'> },
  viewerId: string,
  posts: readonly PostRecord[],
): Promise<PostView[]> {
  if (posts.length === 0) return [];
  const reader = ports.community;
  const authorIds = [...new Set(posts.map((post) => post.authorId))];
  const routeIds = posts.filter((post) => post.attachment?.kind === 'route').map((post) => post.id);
  const [relations, stats, copies] = await Promise.all([
    reader.relations(viewerId, authorIds),
    reader.stats(
      viewerId,
      posts.map((post) => post.id),
    ),
    ports.trips.copiesOf(viewerId, routeIds),
  ]);
  const likerIds = [...stats.values()].flatMap((stat) => (stat.likedBy ? [stat.likedBy] : []));
  const people = new Map(
    (await reader.people([...new Set([...authorIds, ...likerIds])])).map((person) => [
      person.userId,
      person,
    ]),
  );
  return posts.flatMap((post) => {
    const author = people.get(post.authorId);
    if (!author) return [];
    const stat = stats.get(post.id);
    const likedBy = stat?.likedBy ? people.get(stat.likedBy) : undefined;
    return [
      {
        id: post.id,
        kind: post.kind,
        body: post.body,
        place: post.placeName ? { name: post.placeName, countryCode: post.placeCountry } : null,
        audience: post.audience,
        attachment: attachmentView(post.attachment),
        photos: post.photos.map((photo) => ({ mediaId: photo.mediaId, alt: photo.alt })),
        createdAt: post.createdAt.toISOString(),
        editedAt: post.editedAt?.toISOString() ?? null,
        author: personView(author),
        mine: post.authorId === viewerId,
        following: relations.following.has(post.authorId),
        likes: stat?.likes ?? 0,
        liked: stat?.liked ?? false,
        saved: stat?.saved ?? false,
        comments: stat?.comments ?? 0,
        likedBy: likedBy ? personView(likedBy) : null,
        copiedTripId: copies.get(post.id) ?? null,
      },
    ];
  });
}

/** The post if this viewer may see it; otherwise, and for a missing one, the same "not found". */
async function loadVisiblePost(
  reader: CommunityReader,
  viewerId: string,
  postId: string,
): Promise<PostRecord> {
  const post = await reader.findPost(postId);
  if (!post) throw new NotFoundError();
  const [relations, reported] = await Promise.all([
    reader.relations(viewerId, [post.authorId]),
    reader.hasReported(viewerId, post.id),
  ]);
  const visible = canSeePost(
    {
      authorId: post.authorId,
      audience: post.audience,
      deleted: post.deletedAt !== null,
      hidden: post.hiddenAt !== null,
    },
    {
      viewerId,
      follows: relations.following.has(post.authorId),
      muted: relations.muted.has(post.authorId),
      reported,
    },
  );
  if (!visible) throw new NotFoundError();
  return post;
}

/** The author's own post, deleted or not; anyone else's is "not found". */
async function loadOwnPost(reader: CommunityReader, actor: Actor, postId: string) {
  const post = await reader.findPost(postId);
  if (!post || post.authorId !== actor.userId) throw new NotFoundError();
  return post;
}

async function loadPersonByHandle(reader: CommunityReader, handle: string) {
  const profile = await reader.findProfileByHandle(handle);
  if (!profile) throw new NotFoundError();
  return profile;
}

/**
 * Gives the person a community handle the first time they act there: from their name, with a number when it is
 * taken. Nobody sees them in the community before they post or comment.
 */
async function ensureProfile(
  tx: Transaction,
  deps: Pick<Ports, 'users' | 'ids'>,
  actor: Actor,
  now: Date,
): Promise<string> {
  const existing = await tx.community.findProfile(actor.userId);
  if (existing) return existing.handle;
  const user = await deps.users.findById(actor.userId);
  const base = handleFromName(user?.name ?? '');
  for (let attempt = 1; attempt <= 30; attempt++) {
    const handle = attempt === 1 ? base : `${base.slice(0, 20)}${attempt}`;
    if (await tx.community.createProfile(actor.userId, handle, now)) return handle;
  }
  const handle = `${base.slice(0, 12)}${deps.ids.newId().replaceAll('-', '').slice(-8)}`;
  if (!(await tx.community.createProfile(actor.userId, handle, now))) {
    invalid('handle', 'handle_taken', 'Could not find a free handle');
  }
  return handle;
}

async function record(
  tx: Pick<Transaction, 'audit'>,
  deps: Pick<Ports, 'ids'>,
  actor: Actor,
  now: Date,
  action: string,
  entityType: string,
  entityId: string,
  metadata: AuditMetadata = {},
) {
  await tx.audit.record({
    id: deps.ids.newId(),
    occurredAt: now,
    actor,
    action,
    entityType,
    entityId,
    metadata,
  });
}

type Reads = Pick<Ports, 'community' | 'users' | 'clock' | 'trips'>;
type Writes = Pick<Ports, 'unitOfWork' | 'clock' | 'ids' | 'users'>;

// --- Queries ---------------------------------------------------------------------------------------------

export function createListFeed(deps: Reads) {
  return defineOperation({
    name: 'listFeed',
    kind: 'query',
    input: feedQuery,
    output: feedSchema,
    async handler(actor, input) {
      const posts = await deps.community.feed({
        viewerId: actor.userId,
        scope: { kind: input.feed },
        before: input.before,
        limit: input.limit,
      });
      return {
        posts: await postViews(deps, actor.userId, posts),
        nextBefore: posts.length === input.limit ? posts[posts.length - 1]!.id : null,
      };
    },
  });
}

export function createGetPost(deps: Reads) {
  return defineOperation({
    name: 'getPost',
    kind: 'query',
    input: z.object({ postId: z.uuid() }),
    output: postSchema,
    async handler(actor, input) {
      const post = await loadVisiblePost(deps.community, actor.userId, input.postId);
      const [view] = await postViews(deps, actor.userId, [post]);
      if (!view) throw new NotFoundError();
      return view;
    },
  });
}

export function createListComments(deps: Reads) {
  return defineOperation({
    name: 'listComments',
    kind: 'query',
    input: z.object({ postId: z.uuid() }),
    output: commentListSchema,
    async handler(actor, input) {
      const post = await loadVisiblePost(deps.community, actor.userId, input.postId);
      const comments = await deps.community.comments(actor.userId, post.id);
      const people = new Map(
        (await deps.community.people([...new Set(comments.map((c) => c.authorId))])).map((p) => [
          p.userId,
          p,
        ]),
      );
      return {
        comments: comments.flatMap((comment): CommentView[] => {
          const author = people.get(comment.authorId);
          if (!author) return [];
          const mine = comment.authorId === actor.userId;
          return [
            {
              id: comment.id,
              body: comment.body,
              createdAt: comment.createdAt.toISOString(),
              author: personView(author),
              mine,
              canDelete: mine || post.authorId === actor.userId,
              likes: comment.likes,
              liked: comment.liked,
            },
          ];
        }),
      };
    },
  });
}

export function createGetPerson(deps: Reads) {
  return defineOperation({
    name: 'getPerson',
    kind: 'query',
    input: z.object({ handle: handleSchema }),
    output: personPageSchema,
    async handler(actor, input) {
      const profile = await loadPersonByHandle(deps.community, input.handle);
      const [[person], stats, relations] = await Promise.all([
        deps.community.people([profile.userId]),
        deps.community.personStats(profile.userId),
        deps.community.relations(actor.userId, [profile.userId]),
      ]);
      if (!person) throw new NotFoundError();
      return {
        person: personView(person),
        ...stats,
        followed: relations.following.has(profile.userId),
        muted: relations.muted.has(profile.userId),
        mine: profile.userId === actor.userId,
      };
    },
  });
}

export function createListPersonPosts(deps: Reads) {
  return defineOperation({
    name: 'listPersonPosts',
    kind: 'query',
    input: z.object({
      handle: handleSchema,
      before: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
    output: feedSchema,
    async handler(actor, input) {
      const profile = await loadPersonByHandle(deps.community, input.handle);
      const posts = await deps.community.feed({
        viewerId: actor.userId,
        scope: { kind: 'author', authorId: profile.userId },
        before: input.before,
        limit: input.limit,
      });
      return {
        posts: await postViews(deps, actor.userId, posts),
        nextBefore: posts.length === input.limit ? posts[posts.length - 1]!.id : null,
      };
    },
  });
}

export function createGetCommunityMe(deps: Reads) {
  return defineOperation({
    name: 'getCommunityMe',
    kind: 'query',
    input: z.object({}),
    output: communityMeSchema,
    async handler(actor) {
      const [profile, stats, user] = await Promise.all([
        deps.community.findProfile(actor.userId),
        deps.community.personStats(actor.userId),
        deps.users.findById(actor.userId),
      ]);
      return {
        handle: profile?.handle ?? null,
        suggestedHandle: handleFromName(user?.name ?? ''),
        ...stats,
      };
    },
  });
}

export function createGetDiscover(deps: Reads) {
  return defineOperation({
    name: 'getDiscover',
    kind: 'query',
    input: z.object({}),
    output: discoverSchema,
    async handler(actor) {
      const since = new Date(deps.clock.now().getTime() - DISCOVER_DAYS * DAY_MS);
      const [suggestions, trending] = await Promise.all([
        deps.community.suggestions(actor.userId, since, 5),
        deps.community.trending(since, 5),
      ]);
      const people = new Map(
        (await deps.community.people(suggestions.map((s) => s.userId))).map((p) => [p.userId, p]),
      );
      return {
        suggestions: suggestions.flatMap((suggestion) => {
          const person = people.get(suggestion.userId);
          return person ? [{ person: personView(person), posts: suggestion.posts }] : [];
        }),
        trending,
      };
    },
  });
}

// --- Commands --------------------------------------------------------------------------------------------

/** Builds the snapshot a route, visa or goal post carries, from the author's own data only. */
async function attachmentFor(
  tx: Transaction,
  actor: Actor,
  input: z.output<typeof createPostFields>,
  now: Date,
): Promise<PostAttachmentRecord | null> {
  if (input.kind === 'route' || input.kind === 'goal') {
    if (!input.tripId) invalid('tripId', 'required', 'Choose the trip to share');
    const trip = await loadOwnedTrip(tx.trips, actor, input.tripId);
    if (input.kind === 'route') {
      const stops = await tx.destinations.listByTrip(trip.id);
      if (stops.length === 0) invalid('tripId', 'empty_route', 'That trip has no stops yet');
      const budget = input.showAmounts
        ? budgetOf(trip, await tx.expenses.listByTrip(trip.id), await tx.savings.find(trip.id), now)
        : null;
      return {
        kind: 'route',
        title: trip.title,
        nights: stops.reduce((sum, stop) => sum + stop.nights, 0),
        stops: stops.map((stop) => ({
          placeKey: stop.placeKey,
          name: stop.name,
          countryCode: stop.countryCode,
          region: stop.region,
          latitude: stop.latitude,
          longitude: stop.longitude,
          nights: stop.nights,
        })),
        total: budget && !/^0(\.0+)?$/.test(budget.total.amount) ? budget.total : null,
      };
    }
    const budget = budgetOf(
      trip,
      await tx.expenses.listByTrip(trip.id),
      await tx.savings.find(trip.id),
      now,
    );
    const reached = budget.savings.status === 'fully-saved';
    const readyMonth = reached ? now.toISOString().slice(0, 7) : budget.savings.readyMonth;
    if (budget.savings.status === 'no-costs' || !readyMonth) {
      invalid('tripId', 'no_goal', 'That trip has no savings goal on track yet');
    }
    return { kind: 'goal', tripTitle: trip.title, readyMonth, reached };
  }
  if (input.kind === 'visa') {
    if (!input.visaCountry) invalid('visaCountry', 'required', 'Choose the visa to share');
    const visas = await tx.visas.listByUser(actor.userId);
    const oldestFirst = [...visas].sort((a, b) => a.stampedAt.getTime() - b.stampedAt.getTime());
    const index = oldestFirst.findIndex((visa) => visa.countryCode === input.visaCountry);
    const visa = oldestFirst[index];
    if (!visa) invalid('visaCountry', 'unknown_visa', 'You have no visa for that country');
    return {
      kind: 'visa',
      countryCode: visa.countryCode,
      city: visa.city,
      stampedAt: visa.stampedAt.toISOString(),
      ordinal: index + 1,
    };
  }
  return null;
}

export function createCreatePost(deps: Writes) {
  return defineOperation({
    name: 'createPost',
    kind: 'command',
    input: createPostFields.extend({ idempotencyKey: idempotencyKeySchema.optional() }),
    output: postSchema,
    async handler(actor, input) {
      if (needsBody(input.kind) && input.body === '' && input.photos.length === 0) {
        invalid('body', 'required', 'Write something or add a photo before posting');
      }
      if (input.photos.length > 0 && !needsBody(input.kind)) {
        invalid('photos', 'photos_not_allowed', 'Only moments and tips carry photos');
      }
      const now = deps.clock.now();
      const key = input.idempotencyKey;
      return deps.unitOfWork.run(async (tx) => {
        if (key !== undefined) {
          const request = { ...input, idempotencyKey: undefined };
          const start = await tx.idempotency.begin({
            ownerId: actor.userId,
            key,
            fingerprint: `createPost ${canonicalJson(request)}`,
            createdAt: now,
          });
          if (start.state === 'mismatch') throw new IdempotencyKeyReusedError();
          if (start.state === 'replay') return postSchema.parse(start.response);
        }
        const recent = await tx.community.countPostsSince(
          actor.userId,
          new Date(now.getTime() - DAY_MS),
        );
        if (recent >= POSTS_PER_DAY) throw new RateLimitedError('Too many posts today');
        await ensureProfile(tx, deps, actor, now);
        const photos = await ownedPhotos(tx.media, actor, input.photos, 'photos');
        const attachment = await attachmentFor(tx, actor, input, now);
        const place =
          input.place ??
          (attachment?.kind === 'visa'
            ? { name: attachment.city, countryCode: attachment.countryCode }
            : null);
        const id = deps.ids.newId();
        await tx.community.insertPost({
          id,
          authorId: actor.userId,
          kind: input.kind,
          body: input.body,
          placeName: place?.name ?? null,
          placeCountry: place?.countryCode ?? null,
          audience: input.audience,
          attachment,
          photos,
          createdAt: now,
        });
        await record(tx, deps, actor, now, 'post.create', 'post', id, {
          kind: input.kind,
          audience: input.audience,
        });
        const [view] = await postViews(tx, actor.userId, [(await tx.community.findPost(id))!]);
        if (key !== undefined) await tx.idempotency.complete(actor.userId, key, view);
        return view!;
      });
    },
  });
}

export function createUpdatePost(deps: Writes) {
  return defineOperation({
    name: 'updatePost',
    kind: 'command',
    input: updatePostFields.extend({ postId: z.uuid() }),
    output: postSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const post = await loadOwnPost(tx.community, actor, input.postId);
        if (post.deletedAt) throw new NotFoundError();
        if (needsBody(post.kind) && input.body === '' && post.photos.length === 0) {
          invalid('body', 'required', 'A post of this kind needs words');
        }
        await tx.community.updatePost(post.id, { body: input.body, editedAt: now });
        await record(tx, deps, actor, now, 'post.update', 'post', post.id, { fields: ['body'] });
        const [view] = await postViews(tx, actor.userId, [(await tx.community.findPost(post.id))!]);
        return view!;
      });
    },
  });
}

const okSchema = z.object({ ok: z.literal(true) });

/** Deleting hides the post at once; the author can bring it back ("Undo"). */
export function createDeletePost(deps: Writes) {
  return defineOperation({
    name: 'deletePost',
    kind: 'command',
    input: z.object({ postId: z.uuid(), restore: z.boolean().default(false) }),
    output: okSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const post = await loadOwnPost(tx.community, actor, input.postId);
        await tx.community.updatePost(post.id, { deletedAt: input.restore ? null : now });
        await record(
          tx,
          deps,
          actor,
          now,
          input.restore ? 'post.restore' : 'post.delete',
          'post',
          post.id,
        );
        return { ok: true as const };
      });
    },
  });
}

export function createSetPostReaction(deps: Writes, which: 'like' | 'save') {
  return defineOperation({
    name: which === 'like' ? 'setPostLike' : 'setPostSave',
    kind: 'command',
    input: toggleFields.extend({ postId: z.uuid() }),
    output: postSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const post = await loadVisiblePost(tx.community, actor.userId, input.postId);
        if (which === 'like') {
          await ensureProfile(tx, deps, actor, now);
          await tx.community.setLike(post.id, actor.userId, input.on, now);
        } else {
          await tx.community.setSave(post.id, actor.userId, input.on, now);
        }
        await record(tx, deps, actor, now, `post.${which}`, 'post', post.id, { on: input.on });
        const [view] = await postViews(tx, actor.userId, [post]);
        return view!;
      });
    },
  });
}

export function createAddComment(deps: Writes) {
  return defineOperation({
    name: 'addComment',
    kind: 'command',
    input: commentFields.extend({ postId: z.uuid() }),
    output: z.object({ id: z.uuid() }),
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const post = await loadVisiblePost(tx.community, actor.userId, input.postId);
        const recent = await tx.community.countCommentsSince(
          actor.userId,
          new Date(now.getTime() - DAY_MS),
        );
        if (recent >= COMMENTS_PER_DAY) throw new RateLimitedError('Too many comments today');
        await ensureProfile(tx, deps, actor, now);
        const id = deps.ids.newId();
        await tx.community.insertComment({
          id,
          postId: post.id,
          authorId: actor.userId,
          body: input.body,
          createdAt: now,
        });
        await record(tx, deps, actor, now, 'comment.create', 'post', post.id);
        return { id };
      });
    },
  });
}

/** The comment's author or the post's author may remove it; "Undo" brings it back. */
async function loadRemovableComment(
  tx: Transaction,
  actor: Actor,
  commentId: string,
): Promise<CommentRecord> {
  const comment = await tx.community.findComment(commentId);
  if (!comment) throw new NotFoundError();
  const post = await tx.community.findPost(comment.postId);
  if (!post || (comment.authorId !== actor.userId && post.authorId !== actor.userId)) {
    throw new NotFoundError();
  }
  return comment;
}

export function createDeleteComment(deps: Writes) {
  return defineOperation({
    name: 'deleteComment',
    kind: 'command',
    input: z.object({ commentId: z.uuid(), restore: z.boolean().default(false) }),
    output: okSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const comment = await loadRemovableComment(tx, actor, input.commentId);
        await tx.community.setCommentDeleted(comment.id, input.restore ? null : now);
        await record(
          tx,
          deps,
          actor,
          now,
          input.restore ? 'comment.restore' : 'comment.delete',
          'post',
          comment.postId,
        );
        return { ok: true as const };
      });
    },
  });
}

export function createSetCommentLike(deps: Writes) {
  return defineOperation({
    name: 'setCommentLike',
    kind: 'command',
    input: toggleFields.extend({ commentId: z.uuid() }),
    output: okSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const comment = await tx.community.findComment(input.commentId);
        if (!comment || comment.deletedAt) throw new NotFoundError();
        await loadVisiblePost(tx.community, actor.userId, comment.postId);
        await ensureProfile(tx, deps, actor, now);
        await tx.community.setCommentLike(comment.id, actor.userId, input.on, now);
        await record(tx, deps, actor, now, 'comment.like', 'post', comment.postId, {
          on: input.on,
        });
        return { ok: true as const };
      });
    },
  });
}

export function createSetRelation(deps: Writes, which: 'follow' | 'mute') {
  return defineOperation({
    name: which === 'follow' ? 'setFollow' : 'setMute',
    kind: 'command',
    input: toggleFields.extend({ handle: handleSchema }),
    output: personPageSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const profile = await loadPersonByHandle(tx.community, input.handle);
        if (profile.userId === actor.userId) {
          invalid('handle', 'self', `You cannot ${which} yourself`);
        }
        await ensureProfile(tx, deps, actor, now);
        const set = which === 'follow' ? tx.community.setFollow : tx.community.setMute;
        await set(actor.userId, profile.userId, input.on, now);
        await record(tx, deps, actor, now, `person.${which}`, 'user', profile.userId, {
          on: input.on,
        });
        const [[person], stats, relations] = await Promise.all([
          tx.community.people([profile.userId]),
          tx.community.personStats(profile.userId),
          tx.community.relations(actor.userId, [profile.userId]),
        ]);
        return {
          person: personView(person!),
          ...stats,
          followed: relations.following.has(profile.userId),
          muted: relations.muted.has(profile.userId),
          mine: false,
        };
      });
    },
  });
}

/** One report per person; enough distinct reports hide the post from everyone but its author. */
export function createReportPost(deps: Writes) {
  return defineOperation({
    name: 'reportPost',
    kind: 'command',
    input: reportFields.extend({ postId: z.uuid() }),
    output: okSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        const post = await loadVisiblePost(tx.community, actor.userId, input.postId);
        if (post.authorId === actor.userId) {
          invalid('postId', 'own_post', 'You cannot report your own post');
        }
        const reports = await tx.community.report(post.id, actor.userId, input.reason, now);
        if (reports >= REPORTS_TO_HIDE && !post.hiddenAt) {
          await tx.community.updatePost(post.id, { hiddenAt: now });
        }
        await record(tx, deps, actor, now, 'post.report', 'post', post.id, {
          reason: input.reason,
        });
        return { ok: true as const };
      });
    },
  });
}

/** Copies a shared route into a new private trip of the viewer, in USD (never inferred), stops and nights only. */
export function createCopyRoute(deps: Writes) {
  return defineOperation({
    name: 'copyRoute',
    kind: 'command',
    input: z.object({ postId: z.uuid(), idempotencyKey: idempotencyKeySchema.optional() }),
    output: tripSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      const key = input.idempotencyKey;
      return deps.unitOfWork.run(async (tx) => {
        if (key !== undefined) {
          const start = await tx.idempotency.begin({
            ownerId: actor.userId,
            key,
            fingerprint: `copyRoute ${input.postId}`,
            createdAt: now,
          });
          if (start.state === 'mismatch') throw new IdempotencyKeyReusedError();
          if (start.state === 'replay') return tripSchema.parse(start.response);
        }
        const post = await loadVisiblePost(tx.community, actor.userId, input.postId);
        if (post.attachment?.kind !== 'route') throw new NotFoundError();
        const route = post.attachment;
        // One copy per person: copying again hands back the trip they already have.
        const existingId = (await tx.trips.copiesOf(actor.userId, [post.id])).get(post.id);
        const existing = existingId ? await tx.trips.findById(existingId) : null;
        if (existing) {
          const view = toTripView(existing);
          if (key !== undefined) await tx.idempotency.complete(actor.userId, key, view);
          return view;
        }
        await assertTripRoom(tx, actor, now);
        const trip = await tx.trips.insert({
          id: deps.ids.newId(),
          ownerId: actor.userId,
          title: route.title,
          startDate: null,
          currency: DEFAULT_CURRENCY,
          status: DEFAULT_TRIP_STATUS,
          visibility: DEFAULT_TRIP_VISIBILITY,
          copiedFromPostId: post.id,
          createdAt: now,
        });
        await tx.destinations.replaceForTrip(
          trip.id,
          route.stops.map((stop) => ({
            id: deps.ids.newId(),
            ...stop,
            note: null,
            legMode: null,
            visited: false,
            spots: [],
            todos: [],
            photos: [],
          })),
          now,
        );
        await record(tx, deps, actor, now, 'trip.create', 'trip', trip.id, { fromPost: true });
        const view = toTripView(trip);
        if (key !== undefined) await tx.idempotency.complete(actor.userId, key, view);
        return view;
      });
    },
  });
}

export function createUpdateHandle(deps: Writes) {
  return defineOperation({
    name: 'updateHandle',
    kind: 'command',
    input: updateHandleFields,
    output: communityMeSchema,
    async handler(actor, input) {
      const now = deps.clock.now();
      return deps.unitOfWork.run(async (tx) => {
        await ensureProfile(tx, deps, actor, now);
        if (!(await tx.community.updateHandle(actor.userId, input.handle))) {
          invalid('handle', 'handle_taken', 'That handle is taken');
        }
        await record(tx, deps, actor, now, 'person.handle', 'user', actor.userId);
        const stats = await tx.community.personStats(actor.userId);
        return { handle: input.handle, suggestedHandle: input.handle, ...stats };
      });
    },
  });
}
