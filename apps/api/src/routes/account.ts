import {
  accountExportSchema,
  deleteAccountFields,
  tripIdSchema,
  type Application,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];
const ok = {
  description: 'Done.',
  content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } },
};

const exportRoute = createRoute({
  method: 'get',
  path: '/v1/me/export',
  operationId: 'exportAccount',
  tags: ['Account'],
  summary: 'Download all of the account’s data',
  description:
    'Account, preferences, trips with their stops, costs, savings, lists and day plans, visas, community posts, ' +
    'comments, likes, saves, follows, mutes and reports, uploads (ids; each image at `GET /v1/media/{id}`) and the ' +
    'person’s own history. Never password hashes, tokens or other people’s data. Sent as an attachment.',
  security,
  responses: {
    200: {
      description: 'The export.',
      content: { 'application/json': { schema: accountExportSchema } },
    },
    401: problemResponse('No valid session.'),
  },
});

const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/v1/me',
  operationId: 'deleteAccount',
  tags: ['Account'],
  summary: 'Delete the account for good',
  description:
    'Type the account’s email again in `confirmEmail`. Deletes trips and everything in them, visas, the ' +
    'community profile and posts, uploads (and their stored bytes), sessions and sign-in methods. The audit ' +
    'log keeps its rows, which hold no personal data. Cannot be undone.',
  security,
  request: {
    body: { required: true, content: { 'application/json': { schema: deleteAccountFields } } },
  },
  responses: {
    200: ok,
    401: problemResponse('No valid session.'),
    422: problemResponse('The email does not match (`confirmation_mismatch`).'),
  },
});

const deleteTripRoute = createRoute({
  method: 'delete',
  path: '/v1/trips/{id}',
  operationId: 'deleteTrip',
  tags: ['Trips'],
  summary: 'Delete an archived trip for good',
  description:
    'With its stops, costs, savings, lists and day plan. An active trip is refused (archive it first).',
  security,
  request: { params: z.object({ id: tripIdSchema }) },
  responses: {
    200: ok,
    401: problemResponse('No valid session.'),
    404: problemResponse('No such trip, or it belongs to someone else.'),
    422: problemResponse('The trip is not archived (`not_archived`), or the id is not valid.'),
  },
});

/** The actor comes from the session only. */
export function registerAccountRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(exportRoute, async (c) => {
    const exported = await application.exportAccount.execute(c.get('actor'), {});
    c.header(
      'content-disposition',
      `attachment; filename="globetrot-export-${exported.exportedAt.slice(0, 10)}.json"`,
    );
    c.header('cache-control', 'no-store');
    return c.json(exported, 200);
  });
  app.openapi(deleteAccountRoute, async (c) =>
    c.json(await application.deleteAccount.execute(c.get('actor'), c.req.valid('json')), 200),
  );
  app.openapi(deleteTripRoute, async (c) =>
    c.json(await application.deleteTrip.execute(c.get('actor'), c.req.valid('param')), 200),
  );
}
