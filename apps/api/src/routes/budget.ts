import {
  budgetSchema,
  expenseCreateFields,
  expenseFields,
  expenseListSchema,
  expenseSchema,
  savingsFields,
  tripIdSchema,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const tripParams = z.object({ id: tripIdSchema });
const expenseParams = z.object({ id: tripIdSchema, expenseId: z.uuid() });
const notFound = problemResponse('No such trip or cost, or it belongs to someone else.');

const getBudgetRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/budget',
  operationId: 'getBudget',
  tags: ['Budget'],
  summary: 'Totals and the savings answer of a trip',
  description:
    'Everything in the trip’s currency: the total, by category and by status, and the savings plan (how much is ' +
    'left, the month the goal is reached at the current monthly amount, and what to put aside to be ready by departure).',
  security,
  request: { params: tripParams },
  responses: {
    200: { description: 'The budget.', content: { 'application/json': { schema: budgetSchema } } },
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The id is not valid.'),
  },
});

const listExpensesRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/expenses',
  operationId: 'listExpenses',
  tags: ['Budget'],
  summary: 'The costs of a trip, newest first',
  security,
  request: { params: tripParams },
  responses: {
    200: {
      description: 'The costs.',
      content: { 'application/json': { schema: expenseListSchema } },
    },
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The id is not valid.'),
  },
});

const createExpenseRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/expenses',
  operationId: 'createExpense',
  tags: ['Budget'],
  summary: 'Add a cost',
  description:
    'The amount is in `currency`. When that is not the trip’s currency, send `fxRate` (how much of the trip’s ' +
    'currency 1 unit is worth); the server converts, and keeps the rate, its source (`manual`) and its date with the ' +
    'cost. The converted amount is never taken from the client. `guess: true` marks the rough guess of the whole ' +
    'trip (at most one per trip): totals count it minus every other cost, never below zero.',
  security,
  request: {
    params: tripParams,
    body: { required: true, content: { 'application/json': { schema: expenseCreateFields } } },
  },
  responses: {
    201: { description: 'The cost.', content: { 'application/json': { schema: expenseSchema } } },
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The id or the body is not valid.'),
  },
});

const updateExpenseRoute = createRoute({
  method: 'put',
  path: '/v1/trips/{id}/expenses/{expenseId}',
  operationId: 'updateExpense',
  tags: ['Budget'],
  summary: 'Replace a cost',
  security,
  request: {
    params: expenseParams,
    body: { required: true, content: { 'application/json': { schema: expenseFields } } },
  },
  responses: {
    200: { description: 'The cost.', content: { 'application/json': { schema: expenseSchema } } },
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The ids or the body are not valid.'),
  },
});

const deleteExpenseRoute = createRoute({
  method: 'delete',
  path: '/v1/trips/{id}/expenses/{expenseId}',
  operationId: 'deleteExpense',
  tags: ['Budget'],
  summary: 'Remove a cost',
  security,
  request: { params: expenseParams },
  responses: {
    200: { description: 'Removed.', content: { 'application/json': { schema: z.object({}) } } },
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The ids are not valid.'),
  },
});

const updateSavingsRoute = createRoute({
  method: 'put',
  path: '/v1/trips/{id}/savings',
  operationId: 'updateSavings',
  tags: ['Budget'],
  summary: 'Set what is saved and the monthly amount',
  description: 'In the trip’s currency. Only the fields sent change. Answers with the new budget.',
  security,
  request: {
    params: tripParams,
    body: { required: true, content: { 'application/json': { schema: savingsFields } } },
  },
  responses: {
    200: { description: 'The budget.', content: { 'application/json': { schema: budgetSchema } } },
    401: problemResponse('No valid session.'),
    404: notFound,
    422: problemResponse('The id or the body is not valid.'),
  },
});

/** Every handler acts on a trip of the session's own user: the actor comes from the session only. */
export function registerBudgetRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(getBudgetRoute, async (c) =>
    c.json(
      await application.getBudget.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(listExpensesRoute, async (c) =>
    c.json(
      await application.listExpenses.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(createExpenseRoute, async (c) =>
    c.json(
      await application.createExpense.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: c.req.valid('param').id,
      }),
      201,
    ),
  );
  app.openapi(updateExpenseRoute, async (c) => {
    const { id, expenseId } = c.req.valid('param');
    return c.json(
      await application.updateExpense.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: id,
        expenseId,
      }),
      200,
    );
  });
  app.openapi(deleteExpenseRoute, async (c) => {
    const { id, expenseId } = c.req.valid('param');
    return c.json(
      await application.deleteExpense.execute(c.get('actor'), { tripId: id, expenseId }),
      200,
    );
  });
  app.openapi(updateSavingsRoute, async (c) =>
    c.json(
      await application.updateSavings.execute(c.get('actor'), {
        ...c.req.valid('json'),
        tripId: c.req.valid('param').id,
      }),
      200,
    ),
  );
}
