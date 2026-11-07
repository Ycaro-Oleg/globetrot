import {
  preferencesSchema,
  updatePreferencesBodySchema,
  type Application,
} from '@globetrot/application';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';

const security = [{ cookieAuth: [] }];

const getPreferencesRoute = createRoute({
  method: 'get',
  path: '/v1/me/preferences',
  operationId: 'getPreferences',
  tags: ['Account'],
  summary: 'The caller’s settings',
  description:
    'Language, preferred currency, home country, nationality, time zone and units. They are independent: ' +
    'none is derived from another. A user who saved nothing gets USD, the default language and no country, ' +
    'nationality or time zone.',
  security,
  responses: {
    200: {
      description: 'The settings.',
      content: { 'application/json': { schema: preferencesSchema } },
    },
    401: problemResponse('No valid session.'),
  },
});

const updatePreferencesRoute = createRoute({
  method: 'patch',
  path: '/v1/me/preferences',
  operationId: 'updatePreferences',
  tags: ['Account'],
  summary: 'Change the caller’s settings',
  description:
    'Only the fields sent change; every other setting keeps its value. `null` clears the home country, ' +
    'nationality or time zone. The language and the currency cannot be cleared.',
  security,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: updatePreferencesBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'The settings after the change.',
      content: { 'application/json': { schema: preferencesSchema } },
    },
    401: problemResponse('No valid session.'),
    422: problemResponse('A value is not valid, or nothing was sent.'),
  },
});

/** Both handlers act on the session's own settings: there is no user id anywhere in the request. */
export function registerPreferencesRoutes(app: OpenAPIHono<Env>, application: Application) {
  app.openapi(getPreferencesRoute, async (c) =>
    c.json(await application.getPreferences.execute(c.get('actor'), {}), 200),
  );

  app.openapi(updatePreferencesRoute, async (c) =>
    c.json(await application.updatePreferences.execute(c.get('actor'), c.req.valid('json')), 200),
  );
}
