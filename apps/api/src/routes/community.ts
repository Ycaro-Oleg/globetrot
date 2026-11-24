import {
  commentFields,
  commentListSchema,
  communityMeSchema,
  createPostFields,
  discoverSchema,
  feedQuery,
  feedSchema,
  handleSchema,
  idempotencyKeySchema,
  personPageSchema,
  postSchema,
  reportFields,
  tripSchema,
  updateHandleFields,
  updatePostFields,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono, type RouteConfig } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const tags = ['Community'];
const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { 'application/json': { schema } },
});
const unauthenticated = problemResponse('No valid session.');
const notFound = problemResponse(
  'No such post, comment or person, or the session may not see it (answered the same way).',
);
const invalid = problemResponse('The ids or the body are not valid.');
const ok = json(z.object({ ok: z.literal(true) }), 'Done.');

const postParams = z.object({ postId: z.uuid() });
const commentParams = z.object({ commentId: z.uuid() });
const personParams = z.object({ handle: handleSchema });
const idempotency = z.object({ 'idempotency-key': idempotencyKeySchema.optional() });

const route = <R extends Omit<RouteConfig, 'security' | 'tags'>>(config: R) =>
  createRoute({ ...config, security, tags });

const feedRoute = route({
  method: 'get',
  path: '/v1/community/feed',
  operationId: 'listFeed',
  summary: 'The community feed, newest first',
  description:
    '`all` is everything the session may see (public posts, followers-only posts of people it follows, its ' +
    'own); `following` keeps the people it follows and itself. Muted people, reported posts and posts hidden ' +
    'by reports are left out. Page with `before` (the `nextBefore` of the previous page).',
  request: { query: feedQuery },
  responses: { 200: json(feedSchema, 'A page of posts.'), 401: unauthenticated, 422: invalid },
});

const meRoute = route({
  method: 'get',
  path: '/v1/community/me',
  operationId: 'getCommunityMe',
  summary: 'The session’s own handle and counts',
  description: 'The handle is null until the person first posts, comments, likes or follows.',
  responses: { 200: json(communityMeSchema, 'Handle and counts.'), 401: unauthenticated },
});

const handleRoute = route({
  method: 'patch',
  path: '/v1/community/me',
  operationId: 'updateHandle',
  summary: 'Change the session’s handle',
  request: { body: body(updateHandleFields) },
  responses: {
    200: json(communityMeSchema, 'Handle and counts.'),
    401: unauthenticated,
    422: problemResponse('The handle is not valid or is taken (`handle_taken`).'),
  },
});

const discoverRoute = route({
  method: 'get',
  path: '/v1/community/discover',
  operationId: 'getDiscover',
  summary: 'Who to follow and trending destinations',
  description:
    'People with public posts in the last 30 days whom the session neither follows nor muted, and the ' +
    'countries most tagged on public posts in that time.',
  responses: { 200: json(discoverSchema, 'Suggestions.'), 401: unauthenticated },
});

const createPostRoute = route({
  method: 'post',
  path: '/v1/community/posts',
  operationId: 'createPost',
  summary: 'Publish a post',
  description:
    'Moments and tips need words. A route or goal post names one of the session’s trips (`tripId`) and a visa ' +
    'post one of its visas (`visaCountry`): the post carries a copy made now, never a live link to the trip. ' +
    'Route amounts are left out unless `showAmounts`; goal posts never carry amounts. At most 30 posts a day.',
  request: { headers: idempotency, body: body(createPostFields) },
  responses: {
    201: json(postSchema, 'The post as others will read it.'),
    401: unauthenticated,
    404: problemResponse('No such trip, or it belongs to someone else.'),
    409: problemResponse('The Idempotency-Key was already used with a different request.'),
    422: invalid,
    429: problemResponse('Too many posts today.'),
  },
});

const getPostRoute = route({
  method: 'get',
  path: '/v1/community/posts/{postId}',
  operationId: 'getPost',
  summary: 'One post',
  request: { params: postParams },
  responses: {
    200: json(postSchema, 'The post.'),
    401: unauthenticated,
    404: notFound,
    422: invalid,
  },
});

const updatePostRoute = route({
  method: 'patch',
  path: '/v1/community/posts/{postId}',
  operationId: 'updatePost',
  summary: 'Edit the words of one’s own post',
  request: { params: postParams, body: body(updatePostFields) },
  responses: {
    200: json(postSchema, 'The post.'),
    401: unauthenticated,
    404: notFound,
    422: invalid,
  },
});

const deletePostRoute = route({
  method: 'delete',
  path: '/v1/community/posts/{postId}',
  operationId: 'deletePost',
  summary: 'Delete one’s own post',
  description: 'It disappears at once; `restore` brings it back.',
  request: { params: postParams },
  responses: { 200: ok, 401: unauthenticated, 404: notFound, 422: invalid },
});

const restorePostRoute = route({
  method: 'post',
  path: '/v1/community/posts/{postId}/restore',
  operationId: 'restorePost',
  summary: 'Undo deleting one’s own post',
  request: { params: postParams },
  responses: { 200: ok, 401: unauthenticated, 404: notFound, 422: invalid },
});

const toggleRoutes = <P extends string>(
  path: P,
  params: z.ZodObject,
  names: { put: string; delete: string },
  summaries: { put: string; delete: string },
  response: ReturnType<typeof json> | typeof ok,
  description?: string,
) =>
  (['put', 'delete'] as const).map((method) =>
    route({
      method,
      path,
      operationId: names[method],
      summary: summaries[method],
      ...(description ? { description } : {}),
      request: { params },
      responses: { 200: response, 401: unauthenticated, 404: notFound, 422: invalid },
    }),
  );

const likeRoutes = toggleRoutes(
  '/v1/community/posts/{postId}/like',
  postParams,
  { put: 'addLike', delete: 'removeLike' },
  { put: 'Like a post', delete: 'Unlike a post' },
  json(postSchema, 'The post after the change.'),
);
const saveRoutes = toggleRoutes(
  '/v1/community/posts/{postId}/save',
  postParams,
  { put: 'addSave', delete: 'removeSave' },
  { put: 'Save a post', delete: 'Unsave a post' },
  json(postSchema, 'The post after the change.'),
  'Saves are private: only the session knows.',
);

const commentsRoute = route({
  method: 'get',
  path: '/v1/community/posts/{postId}/comments',
  operationId: 'listComments',
  summary: 'A post’s comments, oldest first',
  description: 'Without deleted comments or comments by people the session muted. At most 200.',
  request: { params: postParams },
  responses: {
    200: json(commentListSchema, 'The comments.'),
    401: unauthenticated,
    404: notFound,
    422: invalid,
  },
});

const addCommentRoute = route({
  method: 'post',
  path: '/v1/community/posts/{postId}/comments',
  operationId: 'addComment',
  summary: 'Comment on a post',
  description: 'At most 200 comments a day.',
  request: { params: postParams, body: body(commentFields) },
  responses: {
    201: json(z.object({ id: z.uuid() }), 'The new comment’s id.'),
    401: unauthenticated,
    404: notFound,
    422: invalid,
    429: problemResponse('Too many comments today.'),
  },
});

const reportRoute = route({
  method: 'post',
  path: '/v1/community/posts/{postId}/report',
  operationId: 'reportPost',
  summary: 'Report a post',
  description:
    'Kept for review, once per person. The post is hidden from the reporter at once, and from everyone but its ' +
    'author after 3 distinct reports.',
  request: { params: postParams, body: body(reportFields) },
  responses: { 200: ok, 401: unauthenticated, 404: notFound, 422: invalid },
});

const copyRouteRoute = route({
  method: 'post',
  path: '/v1/community/posts/{postId}/copy-route',
  operationId: 'copyRoute',
  summary: 'Copy a shared route into a new trip',
  description:
    'A new private trip in USD with the route’s stops and nights. `Idempotency-Key` works as for `createTrip`.',
  request: { params: postParams, headers: idempotency },
  responses: {
    201: json(tripSchema, 'The new trip.'),
    401: unauthenticated,
    404: problemResponse('No such route post, or the session may not see it.'),
    409: problemResponse('The Idempotency-Key was already used with a different request.'),
    422: invalid,
  },
});

const deleteCommentRoute = route({
  method: 'delete',
  path: '/v1/community/comments/{commentId}',
  operationId: 'deleteComment',
  summary: 'Remove a comment',
  description: 'Its author or the post’s author may remove it; `restore` brings it back.',
  request: { params: commentParams },
  responses: { 200: ok, 401: unauthenticated, 404: notFound, 422: invalid },
});

const restoreCommentRoute = route({
  method: 'post',
  path: '/v1/community/comments/{commentId}/restore',
  operationId: 'restoreComment',
  summary: 'Undo removing a comment',
  request: { params: commentParams },
  responses: { 200: ok, 401: unauthenticated, 404: notFound, 422: invalid },
});

const commentLikeRoutes = toggleRoutes(
  '/v1/community/comments/{commentId}/like',
  commentParams,
  { put: 'addCommentLike', delete: 'removeCommentLike' },
  { put: 'Like a comment', delete: 'Unlike a comment' },
  ok,
);

const personRoute = route({
  method: 'get',
  path: '/v1/community/people/{handle}',
  operationId: 'getPerson',
  summary: 'A person’s community page',
  request: { params: personParams },
  responses: {
    200: json(personPageSchema, 'The person and their counts.'),
    401: unauthenticated,
    404: notFound,
    422: invalid,
  },
});

const personPostsRoute = route({
  method: 'get',
  path: '/v1/community/people/{handle}/posts',
  operationId: 'listPersonPosts',
  summary: 'A person’s posts the session may see',
  request: {
    params: personParams,
    query: z.object({
      before: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    }),
  },
  responses: {
    200: json(feedSchema, 'A page of posts.'),
    401: unauthenticated,
    404: notFound,
    422: invalid,
  },
});

const followRoutes = toggleRoutes(
  '/v1/community/people/{handle}/follow',
  personParams,
  { put: 'followPerson', delete: 'unfollowPerson' },
  { put: 'Follow a person', delete: 'Unfollow a person' },
  json(personPageSchema, 'The person after the change.'),
  'Following is open: no request to accept. Following oneself is refused (422).',
);
const muteRoutes = toggleRoutes(
  '/v1/community/people/{handle}/mute',
  personParams,
  { put: 'mutePerson', delete: 'unmutePerson' },
  { put: 'Mute a person', delete: 'Unmute a person' },
  json(personPageSchema, 'The person after the change.'),
  'Muting is private: the muted person is not told, and their posts and comments disappear for the session.',
);

/** The actor comes from the session only; another person's private data answers "not found". */
export function registerCommunityRoutes(app: OpenAPIHono<Env>, application: Application) {
  const actor = (c: { get(key: 'actor'): Env['Variables']['actor'] }) => c.get('actor');

  app.openapi(feedRoute, async (c) =>
    c.json(await application.listFeed.execute(actor(c), c.req.valid('query')), 200),
  );
  app.openapi(meRoute, async (c) =>
    c.json(await application.getCommunityMe.execute(actor(c), {}), 200),
  );
  app.openapi(handleRoute, async (c) =>
    c.json(await application.updateHandle.execute(actor(c), c.req.valid('json')), 200),
  );
  app.openapi(discoverRoute, async (c) =>
    c.json(await application.getDiscover.execute(actor(c), {}), 200),
  );
  app.openapi(createPostRoute, async (c) => {
    const key = c.req.valid('header')['idempotency-key'];
    const post = await application.createPost.execute(actor(c), {
      ...c.req.valid('json'),
      ...(key === undefined ? {} : { idempotencyKey: key }),
    });
    return c.json(post, 201);
  });
  app.openapi(getPostRoute, async (c) =>
    c.json(await application.getPost.execute(actor(c), c.req.valid('param')), 200),
  );
  app.openapi(updatePostRoute, async (c) =>
    c.json(
      await application.updatePost.execute(actor(c), {
        ...c.req.valid('json'),
        ...c.req.valid('param'),
      }),
      200,
    ),
  );
  app.openapi(deletePostRoute, async (c) =>
    c.json(await application.deletePost.execute(actor(c), c.req.valid('param')), 200),
  );
  app.openapi(restorePostRoute, async (c) =>
    c.json(
      await application.deletePost.execute(actor(c), { ...c.req.valid('param'), restore: true }),
      200,
    ),
  );
  for (const [routes, operation] of [
    [likeRoutes, application.setPostLike],
    [saveRoutes, application.setPostSave],
  ] as const) {
    for (const toggle of routes) {
      app.openapi(toggle, async (c) =>
        c.json(
          await operation.execute(actor(c), {
            postId: c.req.param('postId'),
            on: toggle.method === 'put',
          }),
          200,
        ),
      );
    }
  }
  app.openapi(commentsRoute, async (c) =>
    c.json(await application.listComments.execute(actor(c), c.req.valid('param')), 200),
  );
  app.openapi(addCommentRoute, async (c) =>
    c.json(
      await application.addComment.execute(actor(c), {
        ...c.req.valid('json'),
        ...c.req.valid('param'),
      }),
      201,
    ),
  );
  app.openapi(reportRoute, async (c) =>
    c.json(
      await application.reportPost.execute(actor(c), {
        ...c.req.valid('json'),
        ...c.req.valid('param'),
      }),
      200,
    ),
  );
  app.openapi(copyRouteRoute, async (c) => {
    const key = c.req.valid('header')['idempotency-key'];
    const trip = await application.copyRoute.execute(actor(c), {
      ...c.req.valid('param'),
      ...(key === undefined ? {} : { idempotencyKey: key }),
    });
    return c.json(trip, 201);
  });
  app.openapi(deleteCommentRoute, async (c) =>
    c.json(await application.deleteComment.execute(actor(c), c.req.valid('param')), 200),
  );
  app.openapi(restoreCommentRoute, async (c) =>
    c.json(
      await application.deleteComment.execute(actor(c), { ...c.req.valid('param'), restore: true }),
      200,
    ),
  );
  for (const like of commentLikeRoutes) {
    app.openapi(like, async (c) =>
      c.json(
        await application.setCommentLike.execute(actor(c), {
          commentId: c.req.param('commentId'),
          on: like.method === 'put',
        }),
        200,
      ),
    );
  }
  app.openapi(personRoute, async (c) =>
    c.json(await application.getPerson.execute(actor(c), c.req.valid('param')), 200),
  );
  app.openapi(personPostsRoute, async (c) =>
    c.json(
      await application.listPersonPosts.execute(actor(c), {
        ...c.req.valid('param'),
        ...c.req.valid('query'),
      }),
      200,
    ),
  );
  for (const [routes, operation] of [
    [followRoutes, application.setFollow],
    [muteRoutes, application.setMute],
  ] as const) {
    for (const toggle of routes) {
      app.openapi(toggle, async (c) =>
        c.json(
          await operation.execute(actor(c), {
            handle: c.req.param('handle'),
            on: toggle.method === 'put',
          }),
          200,
        ),
      );
    }
  }
}
