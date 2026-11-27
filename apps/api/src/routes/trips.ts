import {
  createTripFields,
  createTripFromExampleFields,
  createTripFromSuggestionFields,
  idempotencyKeySchema,
  tripIdSchema,
  tripSchema,
  updateTripBodySchema,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const idParams = z.object({ id: tripIdSchema });

const listTripsRoute = createRoute({
  method: 'get',
  path: '/v1/trips',
  operationId: 'listTrips',
  tags: ['Trips'],
  summary: 'The caller’s trips, newest first',
  description: 'Archived trips are left out unless `includeArchived=true`.',
  security,
  request: {
    query: z.object({
      includeArchived: z
        .enum(['true', 'false'])
        .optional()
        .meta({ description: 'Include archived trips.' }),
    }),
  },
  responses: {
    200: {
      description: 'The trips.',
      content: { 'application/json': { schema: z.object({ trips: z.array(tripSchema) }) } },
    },
    401: problemResponse('No valid session.'),
    422: problemResponse('The query is not valid.'),
  },
});

const createTripRoute = createRoute({
  method: 'post',
  path: '/v1/trips',
  operationId: 'createTrip',
  tags: ['Trips'],
  summary: 'Create a trip',
  description:
    'The trip is private and active, in USD unless a currency is given. Send an `Idempotency-Key` to make a ' +
    'retry safe: the same key and body return the original trip, the same key with another body is a 409.',
  security,
  request: {
    headers: z.object({ 'idempotency-key': idempotencyKeySchema.optional() }),
    body: { required: true, content: { 'application/json': { schema: createTripFields } } },
  },
  responses: {
    201: { description: 'The trip.', content: { 'application/json': { schema: tripSchema } } },
    401: problemResponse('No valid session.'),
    402: problemResponse(
      'The plan’s active trips are used (`TRIP_LIMIT_REACHED`) or more trips are active than the plan keeps (`PLAN_REQUIRED`).',
    ),
    409: problemResponse('The Idempotency-Key was already used with a different request.'),
    422: problemResponse('The body or the header is not valid.'),
  },
});

const createFromExampleRoute = createRoute({
  method: 'post',
  path: '/v1/trips/from-example',
  operationId: 'createTripFromExample',
  tags: ['Trips'],
  summary: 'Copy an example trip',
  description:
    'Creates a private trip in USD with the example’s route and nights. The copy is the person’s own. ' +
    '`Idempotency-Key` works as for `createTrip`.',
  security,
  request: {
    headers: z.object({ 'idempotency-key': idempotencyKeySchema.optional() }),
    body: {
      required: true,
      content: { 'application/json': { schema: createTripFromExampleFields } },
    },
  },
  responses: {
    201: { description: 'The new trip.', content: { 'application/json': { schema: tripSchema } } },
    401: problemResponse('No valid session.'),
    402: problemResponse(
      'The plan’s active trips are used (`TRIP_LIMIT_REACHED`) or more trips are active than the plan keeps (`PLAN_REQUIRED`).',
    ),
    409: problemResponse('The Idempotency-Key was already used with a different request.'),
    422: problemResponse('The body or the header is not valid.'),
  },
});

const createFromSuggestionRoute = createRoute({
  method: 'post',
  path: '/v1/trips/from-suggestion',
  operationId: 'createTripFromSuggestion',
  tags: ['Trips'],
  summary: 'Turn a suggested plan into a trip',
  description:
    'Creates a private trip from a suggested plan (ADR-0020): its stops, nights and legs, its experiences as ' +
    'places, its typical cost as the trip’s estimate (at the recorded reference rate when the trip is not in ' +
    'USD) and the monthly amount. `Idempotency-Key` works as for `createTrip`.',
  security,
  request: {
    headers: z.object({ 'idempotency-key': idempotencyKeySchema.optional() }),
    body: {
      required: true,
      content: { 'application/json': { schema: createTripFromSuggestionFields } },
    },
  },
  responses: {
    201: { description: 'The new trip.', content: { 'application/json': { schema: tripSchema } } },
    401: problemResponse('No valid session.'),
    402: problemResponse(
      'The plan’s active trips are used (`TRIP_LIMIT_REACHED`) or more trips are active than the plan keeps (`PLAN_REQUIRED`).',
    ),
    404: problemResponse('No such suggested destination.'),
    409: problemResponse('The Idempotency-Key was already used with a different request.'),
    422: problemResponse('The body or the header is not valid.'),
  },
});

const getTripRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}',
  operationId: 'getTrip',
  tags: ['Trips'],
  summary: 'One trip',
  security,
  request: { params: idParams },
  responses: {
    200: { description: 'The trip.', content: { 'application/json': { schema: tripSchema } } },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or it belongs to someone else.'),
    422: problemResponse('The id is not valid.'),
  },
});

const updateTripRoute = createRoute({
  method: 'patch',
  path: '/v1/trips/{id}',
  operationId: 'updateTrip',
  tags: ['Trips'],
  summary: 'Change a trip',
  description:
    'Only the fields sent are changed. `startDate: null` clears the date. Setting `status` back to `active` ' +
    'restores an archived trip.',
  security,
  request: {
    params: idParams,
    body: { required: true, content: { 'application/json': { schema: updateTripBodySchema } } },
  },
  responses: {
    200: { description: 'The trip.', content: { 'application/json': { schema: tripSchema } } },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or it belongs to someone else.'),
    422: problemResponse('The id or the body is not valid.'),
  },
});

const archiveTripRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/archive',
  operationId: 'archiveTrip',
  tags: ['Trips'],
  summary: 'Archive a trip',
  description:
    'Hides the trip from the default list. It is not deleted. Archiving an archived trip changes nothing.',
  security,
  request: { params: idParams },
  responses: {
    200: { description: 'The trip.', content: { 'application/json': { schema: tripSchema } } },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or it belongs to someone else.'),
    422: problemResponse('The id is not valid.'),
  },
});

/** Every handler only calls one operation as the session's actor. No rule lives here. */
export function registerTripRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(listTripsRoute, async (c) => {
    const { includeArchived } = c.req.valid('query');
    return c.json(
      await application.listTrips.execute(c.get('actor'), {
        includeArchived: includeArchived === 'true',
      }),
      200,
    );
  });

  app.openapi(createTripRoute, async (c) => {
    const key = c.req.valid('header')['idempotency-key'];
    const trip = await application.createTrip.execute(c.get('actor'), {
      ...c.req.valid('json'),
      ...(key === undefined ? {} : { idempotencyKey: key }),
    });
    return c.json(trip, 201);
  });

  app.openapi(createFromExampleRoute, async (c) => {
    const key = c.req.valid('header')['idempotency-key'];
    const trip = await application.createTripFromExample.execute(c.get('actor'), {
      ...c.req.valid('json'),
      ...(key === undefined ? {} : { idempotencyKey: key }),
    });
    return c.json(trip, 201);
  });

  app.openapi(createFromSuggestionRoute, async (c) => {
    const key = c.req.valid('header')['idempotency-key'];
    const trip = await application.createTripFromSuggestion.execute(c.get('actor'), {
      ...c.req.valid('json'),
      ...(key === undefined ? {} : { idempotencyKey: key }),
    });
    return c.json(trip, 201);
  });

  app.openapi(getTripRoute, async (c) =>
    c.json(await application.getTrip.execute(c.get('actor'), c.req.valid('param')), 200),
  );

  app.openapi(updateTripRoute, async (c) =>
    c.json(
      await application.updateTrip.execute(c.get('actor'), {
        ...c.req.valid('json'),
        ...c.req.valid('param'),
      }),
      200,
    ),
  );

  app.openapi(archiveTripRoute, async (c) =>
    c.json(await application.archiveTrip.execute(c.get('actor'), c.req.valid('param')), 200),
  );
}
