import { billingSchema, type Application } from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];

const getBillingRoute = createRoute({
  method: 'get',
  path: '/v1/me/billing',
  operationId: 'getBilling',
  tags: ['Account'],
  summary: 'The caller’s plan, trial and Pip credits',
  description:
    'Whether the account is in its 7-day trial, on Explorer or Voyager, or read-only after the trial; the ' +
    'active-trip limit; and Pip credits left this period (monthly first, then bought ones). Commands refused by ' +
    'the plan answer `402` with `PLAN_REQUIRED`, `TRIP_LIMIT_REACHED` or `OUT_OF_CREDITS` (ADR-0019).',
  security,
  responses: {
    200: {
      description: 'The plan facts.',
      content: { 'application/json': { schema: billingSchema } },
    },
    401: problemResponse('No valid session.'),
  },
});

const urlSchema = z.object({ url: z.string() });

const checkoutRoute = createRoute({
  method: 'post',
  path: '/v1/me/billing/checkout',
  operationId: 'startCheckout',
  tags: ['Account'],
  summary: 'A hosted checkout for a plan or extra Pip credits',
  description:
    'Answers the payment provider’s checkout URL for Explorer or Voyager (monthly or yearly) or a top-up of ' +
    'Pip credits. Works when the account is read-only. `503` while payments are not switched on.',
  security,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({
            item: z.enum(['explorer', 'voyager', 'top-up']),
            interval: z.enum(['month', 'year']).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Where to send the person.',
      content: { 'application/json': { schema: urlSchema } },
    },
    401: problemResponse('No valid session.'),
    422: problemResponse('The body is not valid.'),
    503: problemResponse('Payments are not switched on yet.'),
  },
});

const portalRoute = createRoute({
  method: 'post',
  path: '/v1/me/billing/portal',
  operationId: 'openBillingPortal',
  tags: ['Account'],
  summary: 'The payment provider’s page to manage the plan',
  description:
    'Change the card, switch or cancel. `404` before the first payment, `503` while payments are off.',
  security,
  responses: {
    200: {
      description: 'Where to send the person.',
      content: { 'application/json': { schema: urlSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('Nothing has been paid yet.'),
    503: problemResponse('Payments are not switched on yet.'),
  },
});

export function registerBillingRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(getBillingRoute, async (c) =>
    c.json(await application.getBilling.execute(c.get('actor'), {}), 200),
  );
  app.openapi(checkoutRoute, async (c) =>
    c.json(await application.startCheckout.execute(c.get('actor'), c.req.valid('json')), 200),
  );
  app.openapi(portalRoute, async (c) =>
    c.json(await application.openBillingPortal.execute(c.get('actor'), {}), 200),
  );
}
