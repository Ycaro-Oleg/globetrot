import {
  confirmInterestResultSchema,
  interestTokenFields,
  joinInterestFields,
  joinInterestResultSchema,
  leaveInterestResultSchema,
  type InterestList,
} from '@globetrot/application';
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import { problemResponse, type Env } from '../http';
import { problem } from '../problem';

/** Joins per minute from one client address. Confirm and unsubscribe allow more (people click twice, mail clients retry). */
export const JOINS_PER_MINUTE = 5;
export const TOKEN_CALLS_PER_MINUTE = 30;

export interface LeadRoutesDependencies {
  readonly list: Pick<InterestList, 'join' | 'confirm' | 'leave'>;
  /**
   * Whether this request may go on, counted per client address in memory only (the address is never stored).
   * The address comes from the same resolution as the sign-in limits.
   */
  readonly allow: (request: Request, bucket: 'join' | 'token', perMinute: number) => boolean;
}

const tags = ['Interest list'];
const limited = problemResponse('Too many requests from this client address (`Retry-After`).');

const joinRoute = createRoute({
  method: 'post',
  path: '/v1/leads',
  operationId: 'joinInterestList',
  tags,
  summary: 'Join the interest list (no session)',
  description:
    'Stores the address with its language, source, first-visit origin and consent, and sends a confirmation ' +
    'email in the background (ADR-0037). Always `202` for a valid request, whether the address is new, repeated, ' +
    'already confirmed, unsubscribed or capped: the answer never says which.',
  request: {
    body: { required: true, content: { 'application/json': { schema: joinInterestFields } } },
  },
  responses: {
    202: {
      description: 'Accepted.',
      content: { 'application/json': { schema: joinInterestResultSchema } },
    },
    422: problemResponse('A field is missing or invalid, `consent` included.'),
    429: limited,
  },
});

const confirmRoute = createRoute({
  method: 'post',
  path: '/v1/leads/confirm',
  operationId: 'confirmInterest',
  tags,
  summary: 'Confirm an interest-list entry (no session)',
  description:
    'With the token from the confirmation link. `internal` is true only for a team or test entry whose token ' +
    'matched.',
  request: {
    body: { required: true, content: { 'application/json': { schema: interestTokenFields } } },
  },
  responses: {
    200: {
      description: 'The result.',
      content: { 'application/json': { schema: confirmInterestResultSchema } },
    },
    422: problemResponse('A malformed token.'),
    429: limited,
  },
});

/** Documented here; served by a plain handler because it also takes a token in the query with a form body. */
const leaveRoute = {
  method: 'post' as const,
  path: '/v1/leads/unsubscribe',
  operationId: 'leaveInterestList',
  tags,
  summary: 'Leave the interest list (no session)',
  description:
    'Deletes the entry and keeps only a keyed hash of the address, so the list never emails it again. The ' +
    'token goes in the JSON body, or in the `token` query parameter with the RFC 8058 form body ' +
    '`List-Unsubscribe=One-Click` (what mail clients send). The same answer for a used, unknown or forged token.',
  request: {
    query: z.object({ token: interestTokenFields.shape.token.optional() }),
    body: {
      required: false,
      content: {
        'application/json': { schema: interestTokenFields },
        'application/x-www-form-urlencoded': {
          schema: z.object({ 'List-Unsubscribe': z.literal('One-Click') }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Unsubscribed.',
      content: { 'application/json': { schema: leaveInterestResultSchema } },
    },
    422: problemResponse('No token, or a malformed one.'),
    429: limited,
  },
};

const tooMany = () => {
  const response = problem(429, 'RATE_LIMITED', { detail: 'Too many requests' });
  response.headers.set('retry-after', '60');
  return response;
};

/**
 * Public routes for visitors without an account. Registered before the session middleware; the `Origin` check
 * still applies. Without the interest list wired, they answer 404.
 */
export function registerLeadRoutes(
  app: OpenAPIHono<Env>,
  leads: LeadRoutesDependencies | undefined,
) {
  app.openapi(joinRoute, async (c) => {
    if (!leads) return problem(404, 'NOT_FOUND') as never;
    if (!leads.allow(c.req.raw, 'join', JOINS_PER_MINUTE)) return tooMany() as never;
    return c.json(await leads.list.join(c.req.valid('json')), 202);
  });

  app.openapi(confirmRoute, async (c) => {
    if (!leads) return problem(404, 'NOT_FOUND') as never;
    if (!leads.allow(c.req.raw, 'token', TOKEN_CALLS_PER_MINUTE)) return tooMany() as never;
    return c.json(await leads.list.confirm(c.req.valid('json')), 200);
  });

  app.openAPIRegistry.registerPath(leaveRoute);
  app.post(leaveRoute.path, async (c) => {
    if (!leads) return problem(404, 'NOT_FOUND');
    if (!leads.allow(c.req.raw, 'token', TOKEN_CALLS_PER_MINUTE)) return tooMany();
    let token: unknown = c.req.query('token');
    if (token === undefined && (c.req.header('content-type') ?? '').includes('application/json')) {
      const body = (await c.req.json().catch(() => ({}))) as { token?: unknown };
      token = body.token;
    }
    return c.json(await leads.list.leave({ token }), 200);
  });
}
