import {
  adminMetricsSchema,
  billingSchema,
  referralSchema,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];

const getBillingRoute = createRoute({
  method: 'get',
  path: '/v1/me/billing',
  operationId: 'getBilling',
  tags: ['Account'],
  summary: 'The caller’s plan, trial, trip passes and Pip credits',
  description:
    'Whether the account is in its 7-day trial, on Explorer or Voyager, or on the free plan; the active-trip ' +
    'limit (trips with a pass do not count) and whether more trips are active than it keeps; the currency ' +
    'prices are shown in; and Pip credits left this period (monthly first, then bought ones). Commands refused ' +
    'by the plan answer `402` with `PLAN_REQUIRED`, `TRIP_LIMIT_REACHED` or `OUT_OF_CREDITS` (ADR-0019, ADR-0023).',
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
  summary: 'A hosted checkout for a plan, extra Pip credits or a trip pass',
  description:
    'Answers the payment provider’s checkout URL for Explorer or Voyager (monthly or yearly), a top-up of ' +
    'Pip credits or a pass for one of the person’s trips (ADR-0023), in reais when their currency is BRL and ' +
    'in US dollars otherwise. Works over the trip limit. `404` for a pass on a trip that is not theirs, `503` ' +
    'while payments are not switched on.',
  security,
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({
            item: z.enum(['explorer', 'voyager', 'top-up', 'top-up-small', 'trip-pass']),
            interval: z.enum(['month', 'year']).optional(),
            tripId: z.uuid().optional().meta({ description: 'The trip a pass is for.' }),
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
    404: problemResponse('The trip for the pass is not one of the person’s trips.'),
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

const referralRoute = createRoute({
  method: 'post',
  path: '/v1/me/referral',
  operationId: 'getReferral',
  tags: ['Account'],
  summary: 'The caller’s referral link and what it earned',
  description:
    'Makes the code the first time (ADR-0029). The link is the site with `?ref={code}`; a friend’s first ' +
    'payment gives the caller a free trip pass.',
  security,
  responses: {
    200: {
      description: 'The code and counts.',
      content: { 'application/json': { schema: referralSchema } },
    },
    401: problemResponse('No valid session.'),
  },
});

const claimReferralRoute = createRoute({
  method: 'post',
  path: '/v1/me/referral/claim',
  operationId: 'claimReferral',
  tags: ['Account'],
  summary: 'Say who sent this new account',
  description:
    'Within 7 days of signing up, never one’s own code, once. An unknown code answers `claimed: false`.',
  security,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: z.object({ code: z.string().max(16) }) } },
    },
  },
  responses: {
    200: {
      description: 'Whether it was recorded.',
      content: { 'application/json': { schema: z.object({ claimed: z.boolean() }) } },
    },
    401: problemResponse('No valid session.'),
    422: problemResponse('The code is not valid.'),
  },
});

const redeemRoute = createRoute({
  method: 'post',
  path: '/v1/trips/{id}/pass/redeem',
  operationId: 'redeemPassCredit',
  tags: ['Account'],
  summary: 'Use a free trip pass on one of the caller’s trips',
  security,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      description: 'Until when the pass holds.',
      content: { 'application/json': { schema: z.object({ validUntil: z.string() }) } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip of the caller’s, or no free pass left.'),
  },
});

const adminMetricsRoute = createRoute({
  method: 'get',
  path: '/v1/admin/metrics',
  operationId: 'getAdminMetrics',
  tags: ['Account'],
  summary: 'The internal dashboard’s counts (admins only)',
  description:
    'Counts only, never people (ADR-0031). Only verified accounts listed in `ADMIN_EMAILS`; everyone else gets `404`.',
  security,
  responses: {
    200: {
      description: 'The counts.',
      content: { 'application/json': { schema: adminMetricsSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('Not an admin.'),
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
  app.openapi(referralRoute, async (c) =>
    c.json(await application.getReferral.execute(c.get('actor'), {}), 200),
  );
  app.openapi(claimReferralRoute, async (c) =>
    c.json(await application.claimReferral.execute(c.get('actor'), c.req.valid('json')), 200),
  );
  app.openapi(redeemRoute, async (c) =>
    c.json(
      await application.redeemPassCredit.execute(c.get('actor'), {
        tripId: c.req.valid('param').id,
      }),
      200,
    ),
  );
  app.openapi(adminMetricsRoute, async (c) =>
    c.json(await application.getAdminMetrics.execute(c.get('actor'), {}), 200),
  );
}
