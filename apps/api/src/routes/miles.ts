import { milesViewSchema, type Application } from '@globetrot/application';
import { MILES_PROGRAMS } from '@globetrot/domain';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const saved = z.object({ saved: z.boolean() });

const getMilesRoute = createRoute({
  method: 'get',
  path: '/v1/trips/{id}/miles',
  operationId: 'getMiles',
  tags: ['Budget'],
  summary: 'The caller’s miles, their typical value and the savings answer counting them',
  description:
    'Balances per programme with a typical value in reais (researched ranges with their date and sources), the ' +
    'miles put towards this trip and what is left counting them (ADR-0030). Always estimates.',
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: 'The miles.',
      content: { 'application/json': { schema: milesViewSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not one the caller plans.'),
  },
});

const setMilesRoute = createRoute({
  method: 'put',
  path: '/v1/me/miles/{program}',
  operationId: 'setMiles',
  tags: ['Account'],
  summary: 'A programme’s balance (zero removes it)',
  security,
  request: {
    params: z.object({ program: z.enum(MILES_PROGRAMS) }),
    body: {
      required: true,
      content: { 'application/json': { schema: z.object({ balance: z.number().int() }) } },
    },
  },
  responses: {
    200: { description: 'Saved.', content: { 'application/json': { schema: saved } } },
    401: problemResponse('No valid session.'),
    422: problemResponse('The balance is not valid.'),
  },
});

const setTripMilesRoute = createRoute({
  method: 'put',
  path: '/v1/trips/{id}/miles/{program}',
  operationId: 'setTripMiles',
  tags: ['Budget'],
  summary: 'How many miles of a programme go towards the trip (zero removes it)',
  security,
  request: {
    params: z.object({ id: z.uuid(), program: z.enum(MILES_PROGRAMS) }),
    body: {
      required: true,
      content: { 'application/json': { schema: z.object({ miles: z.number().int() }) } },
    },
  },
  responses: {
    200: { description: 'Saved.', content: { 'application/json': { schema: saved } } },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or not one the caller plans.'),
    422: problemResponse('More miles than the balance, or not a valid number.'),
  },
});

export function registerMilesRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(getMilesRoute, async (c) =>
    c.json(
      await application.getMiles.execute(c.get('actor'), { tripId: c.req.valid('param').id }),
      200,
    ),
  );
  app.openapi(setMilesRoute, async (c) =>
    c.json(
      await application.setMiles.execute(c.get('actor'), {
        program: c.req.valid('param').program,
        balance: c.req.valid('json').balance,
      }),
      200,
    ),
  );
  app.openapi(setTripMilesRoute, async (c) => {
    const { id, program } = c.req.valid('param');
    return c.json(
      await application.setTripMiles.execute(c.get('actor'), {
        tripId: id,
        program,
        miles: c.req.valid('json').miles,
      }),
      200,
    );
  });
}
