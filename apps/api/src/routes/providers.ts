import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../http';

export const providersSchema = z.object({
  providers: z
    .array(z.enum(['google']))
    .meta({ description: 'The social sign-in providers that are configured and can be offered.' }),
});

const providersRoute = createRoute({
  method: 'get',
  path: '/v1/auth/providers',
  operationId: 'listAuthProviders',
  tags: ['Account'],
  summary: 'Which social sign-in buttons to show',
  description:
    'Public. A provider is listed only when the server has it configured, so a screen never offers a button ' +
    'that cannot work. Email and password is always available and is not listed.',
  responses: {
    200: {
      description: 'The enabled providers (possibly none).',
      content: { 'application/json': { schema: providersSchema } },
    },
  },
});

/**
 * Registered **before** the authentication middleware (see `app.ts`): the sign-in screens ask this before
 * anyone is signed in.
 */
export function registerProviderRoutes(
  app: OpenAPIHono<Env>,
  enabledProviders: readonly 'google'[],
) {
  app.openapi(providersRoute, (c) => c.json({ providers: [...enabledProviders] }, 200));
}
