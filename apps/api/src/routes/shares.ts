import {
  sharedTripSchema,
  tripShareSchema,
  type Application,
  type SharedTripView,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problem } from '../problem';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const tripParams = z.object({ id: z.uuid() });

const getShareRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/share',
  operationId: 'getTripShare',
  tags: ['Trips'],
  summary: 'Whether the trip has a public link',
  security,
  request: { params: tripParams },
  responses: {
    200: {
      description: 'The link, or `slug: null`.',
      content: { 'application/json': { schema: tripShareSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not yours.'),
  },
});

const shareRoute = createRoute({
  method: 'put',
  path: '/v1/trips/{id}/share',
  operationId: 'shareTrip',
  tags: ['Trips'],
  summary: 'Turn the public link on, or change whether amounts show',
  description:
    'Keeps the same address when the link is already on. The page shows the route, the month and the savings ' +
    'answer, and amounts only with `showAmounts`; never the person’s name or the exact dates.',
  security,
  request: {
    params: tripParams,
    body: {
      required: true,
      content: {
        'application/json': { schema: z.object({ showAmounts: z.boolean().optional() }) },
      },
    },
  },
  responses: {
    200: { description: 'The link.', content: { 'application/json': { schema: tripShareSchema } } },
    401: problemResponse('No valid session.'),
    402: problemResponse('The trial is over (`PLAN_REQUIRED`).'),
    404: problemResponse('No such trip, or not yours.'),
  },
});

const unshareRoute = createRoute({
  method: 'delete',
  path: '/v1/trips/{id}/share',
  operationId: 'unshareTrip',
  tags: ['Trips'],
  summary: 'Turn the public link off for good',
  description: 'The old address answers 404 from now on. Works even when the account is read-only.',
  security,
  request: { params: tripParams },
  responses: {
    200: {
      description: '`slug: null`.',
      content: { 'application/json': { schema: tripShareSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not yours.'),
  },
});

export const sharedTripRoute = createRoute({
  method: 'get',
  path: '/v1/shared/{slug}',
  operationId: 'getSharedTrip',
  tags: ['Trips'],
  summary: 'A shared trip, for anyone with the link',
  description:
    'No session. An unknown, malformed or stopped link and an archived trip all answer 404 the same way.',
  request: { params: z.object({ slug: z.string().max(64) }) },
  responses: {
    200: {
      description: 'The public view.',
      content: { 'application/json': { schema: sharedTripSchema } },
    },
    404: problemResponse('No such link.'),
  },
});

/** The public page's data: registered before the session middleware. */
export function registerSharedTripRoute(
  app: OpenAPIHono<Env>,
  shared: { view(slug: string): Promise<SharedTripView | null> },
) {
  app.openapi(sharedTripRoute, async (c) => {
    const view = await shared.view(c.req.valid('param').slug);
    if (!view) return problem(404, 'NOT_FOUND') as never;
    c.header('cache-control', 'public, max-age=60');
    return c.json(view, 200);
  });
}

export function registerShareRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(getShareRoute, async (c) =>
    c.json(
      await application.getTripShare.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(shareRoute, async (c) =>
    c.json(
      await application.shareTrip.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
        showAmounts: c.req.valid('json').showAmounts ?? false,
      }),
      200,
    ),
  );
  app.openapi(unshareRoute, async (c) =>
    c.json(
      await application.unshareTrip.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
}
