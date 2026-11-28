import { habitSchema, savingsHistorySchema, type Application } from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const tripParams = z.object({ id: z.uuid() });

const habitRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/habit',
  operationId: 'getHabit',
  tags: ['Budget'],
  summary: 'This week’s check-in, the streak and the countdown',
  description:
    'The ISO week in the person’s time zone, whether they checked in, weeks in a row, a suggested amount (a ' +
    'week of their monthly amount) and the trip’s countdown phase with checklist suggestions (ADR-0026).',
  security,
  request: { params: tripParams },
  responses: {
    200: { description: 'The habit.', content: { 'application/json': { schema: habitSchema } } },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not one the caller plans.'),
  },
});

const checkInRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/checkin',
  operationId: 'checkIn',
  tags: ['Budget'],
  summary: '“I set this aside this week”',
  description:
    'Adds the amount to the person’s savings (their own on a shared trip, the trip’s otherwise). Checking in ' +
    'again the same week changes the amount instead of adding to it.',
  security,
  request: {
    params: tripParams,
    body: {
      required: true,
      content: { 'application/json': { schema: z.object({ amount: z.string() }) } },
    },
  },
  responses: {
    200: {
      description: 'Recorded.',
      content: {
        'application/json': {
          schema: z.object({
            week: z.string(),
            amount: z.object({ amount: z.string(), currency: z.string() }),
          }),
        },
      },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not one the caller plans.'),
    422: problemResponse('The amount is not valid.'),
  },
});

const historyRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/savings/history',
  operationId: 'getSavingsHistory',
  tags: ['Budget'],
  summary: 'How the trip’s savings grew, week by week',
  description:
    'Everyone’s weekly check-ins added up per week (at most two years), with the running total that ends at what ' +
    'is set aside today; savings typed in rather than checked in are the starting balance.',
  security,
  request: { params: tripParams },
  responses: {
    200: {
      description: 'The history.',
      content: { 'application/json': { schema: savingsHistorySchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not one the caller plans.'),
  },
});

export function registerHabitRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(habitRoute, async (c) =>
    c.json(
      await application.getHabit.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(historyRoute, async (c) =>
    c.json(
      await application.getSavingsHistory.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
      }),
      200,
    ),
  );
  app.openapi(checkInRoute, async (c) =>
    c.json(
      await application.checkIn.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
        amount: c.req.valid('json').amount,
      }),
      200,
    ),
  );
}
