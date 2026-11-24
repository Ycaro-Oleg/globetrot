import {
  destinationListSchema,
  replaceDestinationsBody,
  replaceDestinationsResult,
  tripIdSchema,
  visaListSchema,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const idParams = z.object({ id: tripIdSchema });

const listDestinationsRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/destinations',
  operationId: 'listDestinations',
  tags: ['Trips'],
  summary: 'The stops of a trip’s route, in order',
  security,
  request: { params: idParams },
  responses: {
    200: {
      description: 'The route.',
      content: { 'application/json': { schema: destinationListSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or it belongs to someone else.'),
    422: problemResponse('The id is not valid.'),
  },
});

const replaceDestinationsRoute = createRoute({
  method: 'put',
  path: '/v1/trips/{id}/destinations',
  operationId: 'replaceDestinations',
  tags: ['Trips'],
  summary: 'Replace a trip’s whole route',
  description:
    'Sends the route as it should be, in order. The server assigns ids and positions, so sending the same route ' +
    'twice changes nothing. At most 100 stops. An empty list clears the route. The first stop marked visited in ' +
    'a country stamps a commemorative visa (never an official document); the stamps this change gave are in ' +
    '`stampedVisas`.',
  security,
  request: {
    params: idParams,
    body: { required: true, content: { 'application/json': { schema: replaceDestinationsBody } } },
  },
  responses: {
    200: {
      description: 'The route as stored, and the visas it stamped.',
      content: { 'application/json': { schema: replaceDestinationsResult } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or it belongs to someone else.'),
    422: problemResponse('The id or the body is not valid.'),
  },
});

const listVisasRoute = createRoute({
  method: 'get',
  path: '/v1/visas',
  operationId: 'listVisas',
  tags: ['Passport'],
  summary: 'The session user’s commemorative visas',
  description:
    'One per country, stamped by the first stop marked visited there. Decorative: never an official document.',
  security,
  responses: {
    200: {
      description: 'The visas, newest first.',
      content: { 'application/json': { schema: visaListSchema } },
    },
    401: problemResponse('No valid session.'),
  },
});

/** Every handler acts for the session's own user: the actor comes from the session only. */
export function registerDestinationRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(listDestinationsRoute, async (c) =>
    c.json(
      await application.listDestinations.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
      }),
      200,
    ),
  );

  app.openapi(replaceDestinationsRoute, async (c) =>
    c.json(
      await application.replaceDestinations.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: c.req.valid('param').id,
      }),
      200,
    ),
  );

  app.openapi(listVisasRoute, async (c) =>
    c.json(await application.listVisas.execute(c.get('actor'), {}), 200),
  );
}
