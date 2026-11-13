import {
  addDayPlaceFields,
  dayPlanSchema,
  moveDayPlaceFields,
  tripIdSchema,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const tripParams = z.object({ id: tripIdSchema });
const placeParams = z.object({ id: tripIdSchema, placeId: z.uuid() });
const notFound = problemResponse('No such trip or place, or it belongs to someone else.');
const planResponse = {
  description: 'The trip’s places to see, in trip order, each on a day or on "No day".',
  content: { 'application/json': { schema: dayPlanSchema } },
};

const listRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/day-places',
  operationId: 'listDayPlaces',
  tags: ['Days'],
  summary: 'The places to see of a trip and their days',
  description:
    'A place on a day that the route no longer reaches reads as "No day"; a place whose stop was removed reads ' +
    'with no stop. Neither is lost.',
  security,
  request: { params: tripParams },
  responses: {
    200: planResponse,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The id is not valid.'),
  },
});

const addRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/day-places',
  operationId: 'addDayPlace',
  tags: ['Days'],
  summary: 'Save a place to "No day"',
  description: 'A trip keeps at most 200 places. Answers with the new plan.',
  security,
  request: {
    params: tripParams,
    body: { required: true, content: { 'application/json': { schema: addDayPlaceFields } } },
  },
  responses: {
    201: planResponse,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse(
      'The id or the body is not valid, the stop is not on the trip, or the plan is full.',
    ),
  },
});

const moveRoute = createRoute({
  method: 'patch',
  path: '/v1/trips/{id}/day-places/{placeId}',
  operationId: 'moveDayPlace',
  tags: ['Days'],
  summary: 'Move a place to a day or to "No day"',
  description:
    'To the end of the day, or just before `beforeId` (a place on that same day). A day the route does not have ' +
    'is refused.',
  security,
  request: {
    params: placeParams,
    body: { required: true, content: { 'application/json': { schema: moveDayPlaceFields } } },
  },
  responses: {
    200: planResponse,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The ids or the body are not valid, or the day is not on the route.'),
  },
});

const removeRoute = createRoute({
  method: 'delete',
  path: '/v1/trips/{id}/day-places/{placeId}',
  operationId: 'removeDayPlace',
  tags: ['Days'],
  summary: 'Remove a place',
  security,
  request: { params: placeParams },
  responses: {
    200: planResponse,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The ids are not valid.'),
  },
});

/** Every handler acts on a trip of the session's own user: the actor comes from the session only. */
export function registerDayPlaceRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(listRoute, async (c) =>
    c.json(
      await application.listDayPlaces.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(addRoute, async (c) =>
    c.json(
      await application.addDayPlace.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: c.req.valid('param').id,
      }),
      201,
    ),
  );
  app.openapi(moveRoute, async (c) => {
    const { id, placeId } = c.req.valid('param');
    return c.json(
      await application.moveDayPlace.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: id,
        placeId,
      }),
      200,
    );
  });
  app.openapi(removeRoute, async (c) => {
    const { id, placeId } = c.req.valid('param');
    return c.json(
      await application.removeDayPlace.execute(c.get('actor'), { tripId: id, placeId }),
      200,
    );
  });
}
