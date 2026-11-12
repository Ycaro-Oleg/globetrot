import {
  addChecklistItemsFields,
  checklistSchema,
  tripIdSchema,
  updateChecklistItemFields,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const tripParams = z.object({ id: tripIdSchema });
const itemParams = z.object({ id: tripIdSchema, itemId: z.uuid() });
const notFound = problemResponse('No such trip or item, or it belongs to someone else.');
const listResponse = {
  description: 'The lists and the readiness stamps.',
  content: { 'application/json': { schema: checklistSchema } },
};

const getChecklistRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/checklist',
  operationId: 'getChecklist',
  tags: ['Checklists'],
  summary: 'The checklists of a trip and its readiness stamps',
  description:
    'Four groups (documents, money, bookings, packing) in the order the items were added, and the nine readiness ' +
    'stamps as they stand now. Stamps are computed, not stored: they come and go with what the trip has today.',
  security,
  request: { params: tripParams },
  responses: {
    200: listResponse,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The id is not valid.'),
  },
});

const addItemsRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/checklist',
  operationId: 'addChecklistItems',
  tags: ['Checklists'],
  summary: 'Add one or several items',
  description: 'A trip keeps at most 100 items. Answers with the new lists.',
  security,
  request: {
    params: tripParams,
    body: { required: true, content: { 'application/json': { schema: addChecklistItemsFields } } },
  },
  responses: {
    201: listResponse,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The id or the body is not valid, or the trip’s lists are full.'),
  },
});

const updateItemRoute = createRoute({
  method: 'patch',
  path: '/v1/trips/{id}/checklist/{itemId}',
  operationId: 'updateChecklistItem',
  tags: ['Checklists'],
  summary: 'Check, uncheck or rename an item',
  security,
  request: {
    params: itemParams,
    body: {
      required: true,
      content: { 'application/json': { schema: updateChecklistItemFields } },
    },
  },
  responses: {
    200: listResponse,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The ids or the body are not valid.'),
  },
});

const deleteItemRoute = createRoute({
  method: 'delete',
  path: '/v1/trips/{id}/checklist/{itemId}',
  operationId: 'deleteChecklistItem',
  tags: ['Checklists'],
  summary: 'Remove an item',
  security,
  request: { params: itemParams },
  responses: {
    200: listResponse,
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The ids are not valid.'),
  },
});

/** Every handler acts on a trip of the session's own user: the actor comes from the session only. */
export function registerChecklistRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(getChecklistRoute, async (c) =>
    c.json(
      await application.getChecklist.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(addItemsRoute, async (c) =>
    c.json(
      await application.addChecklistItems.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: c.req.valid('param').id,
      }),
      201,
    ),
  );
  app.openapi(updateItemRoute, async (c) => {
    const { id, itemId } = c.req.valid('param');
    return c.json(
      await application.updateChecklistItem.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: id,
        itemId,
      }),
      200,
    );
  });
  app.openapi(deleteItemRoute, async (c) => {
    const { id, itemId } = c.req.valid('param');
    return c.json(
      await application.deleteChecklistItem.execute(c.get('actor'), { tripId: id, itemId }),
      200,
    );
  });
}
