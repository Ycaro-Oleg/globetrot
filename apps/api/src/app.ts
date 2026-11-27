import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  ApplicationError,
  UnauthenticatedError,
  currentUserSchema,
  type Application,
  type InboundEmail,
  type InboundOutcome,
  type SharedTripView,
} from '@globetrot/application';
import { timingSafeEqual } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { problemResponse, type Env } from './http';
import { problem, problemFromApplicationError } from './problem';
import { registerBudgetRoutes } from './routes/budget';
import { registerChecklistRoutes } from './routes/checklists';
import { registerCommunityRoutes } from './routes/community';
import { registerMediaRoutes } from './routes/media';
import { registerAccountRoutes } from './routes/account';
import { registerBillingRoutes } from './routes/billing';
import { registerShareRoutes, registerSharedTripRoute } from './routes/shares';
import { registerMemberRoutes } from './routes/members';
import { registerHabitRoutes } from './routes/habit';
import { registerMilesRoutes } from './routes/miles';
import { registerPipRoutes } from './routes/pip';
import { registerDayPlaceRoutes } from './routes/day-places';
import { registerDestinationRoutes } from './routes/destinations';
import { registerPlaceRoutes } from './routes/places';
import { registerPreferencesRoutes } from './routes/preferences';
import { registerProviderRoutes } from './routes/providers';
import { registerTripRoutes } from './routes/trips';

/**
 * What the HTTP layer needs from the auth library: Better Auth's request handler for `/api/auth/*`, and a way
 * to turn the request's cookies into the signed-in user's id. Nothing else about a caller is ever trusted.
 */
export interface AuthService {
  handler(request: Request): Promise<Response>;
  /** Resolves the session from the request headers (the session cookie), or `null` when there is none. */
  getSession(headers: Headers): Promise<{ readonly userId: string } | null>;
}

export interface AppDependencies {
  readonly auth: AuthService;
  readonly application: Application;
  /** Origins (scheme + host + port) allowed to send state-changing browser requests. */
  readonly trustedOrigins: readonly string[];
  /** Social sign-in providers that are configured. None until Google is set up (#55). */
  readonly enabledProviders?: readonly 'google'[];
  /** Whether the API can serve: the database answers. `/ready` reports it for the platform's health check. */
  readonly readiness?: () => Promise<boolean>;
  /** Stripe's webhook: raw body and signature in, the HTTP status out (ADR-0019). Absent: the route is 404. */
  /** The public view of shared trips; absent, the route answers 404. */
  readonly sharedTrips?: { view(slug: string): Promise<SharedTripView | null> } | undefined;
  /** Called with each unexpected error (a bug), after it is logged: error monitoring, when on. */
  readonly onUnexpectedError?: ((error: Error) => void) | undefined;
  readonly paymentWebhook?:
    ((rawBody: string, signature: string | null) => Promise<number>) | undefined;
  /** Forwarded booking emails (ADR-0032). Absent: the inbound route is 404 and no address is offered. */
  readonly inboundEmail?:
    | {
        readonly secret: string;
        readonly domain: string;
        readonly local: string;
        receive(email: InboundEmail): Promise<InboundOutcome>;
      }
    | undefined;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const inboundAddressRoute = createRoute({
  method: 'post',
  path: '/v1/me/inbound',
  operationId: 'getInboundAddress',
  tags: ['Account'],
  summary: 'The caller’s address for forwarding bookings to Pip',
  description:
    'Makes the address the first time (ADR-0032). A forwarded booking becomes a Pip proposal for the latest ' +
    'active trip, to review. `address: null` while forwarding is not switched on.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'The address, or null.',
      content: {
        'application/json': { schema: z.object({ address: z.string().nullable() }) },
      },
    },
    401: problemResponse('No valid session.'),
  },
});

/** OpenAPI document metadata. The version is the version of the `/v1` contract, not of the app. */
export const OPENAPI_CONFIG = {
  openapi: '3.1.0',
  info: {
    title: 'Globetrot API',
    version: '1.0.0',
    description:
      'Operations of the Globetrot application. Authenticated with the session cookie set by `/api/auth/*`; ' +
      'the caller is always the session owner and no request field can name another user.',
  },
} as const;

const getCurrentUserRoute = createRoute({
  method: 'get',
  path: '/v1/me',
  operationId: 'getCurrentUser',
  tags: ['Account'],
  summary: 'The signed-in user',
  description: 'Only the caller’s own id, email, name and whether the email is verified.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'The caller’s account.',
      content: { 'application/json': { schema: currentUserSchema } },
    },
    401: problemResponse('No valid session.'),
    404: problemResponse('The session’s account no longer exists.'),
  },
});

/**
 * Builds the HTTP app. Routes stay thin: they delegate to @globetrot/application (ADR-0006) or, for
 * sign-in and sessions, to Better Auth. The browser never calls this app directly: the web app proxies
 * `/api/auth/*` and `/v1/*` to it so the session cookie stays first-party
 * (docs/architecture/authentication.md, docs/architecture/api-contracts.md).
 */
export function createApp({
  auth,
  application,
  trustedOrigins,
  enabledProviders = [],
  readiness = async () => true,
  paymentWebhook,
  inboundEmail,
  sharedTrips = { view: async () => null },
  onUnexpectedError = () => {},
}: AppDependencies) {
  const app = new OpenAPIHono<Env>({
    // Input that fails an operation's schema before the handler runs.
    defaultHook: (result) => {
      if (!result.success) {
        return problem(422, 'VALIDATION_FAILED', {
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
        });
      }
      return undefined;
    },
  });
  const trusted = new Set(trustedOrigins);

  // Liveness: the process answers. Readiness: it can reach what it needs (the database).
  app.get('/health', (c) => c.json({ status: 'ok', service: 'api' }));
  app.get('/ready', async (c) =>
    (await readiness().catch(() => false))
      ? c.json({ status: 'ready', service: 'api' }, 200)
      : c.json({ status: 'unavailable', service: 'api' }, 503),
  );

  // Cross-site request forgery: a browser always sends `Origin` on a cross-site POST. Better Auth only
  // checks it for requests that carry cookies, which would still let a hostile page start a sign-in or
  // sign-up in the victim's browser (login CSRF). So any state-changing request that names an origin we
  // do not trust is refused here, on auth and on the operations alike. Clients that send no `Origin`
  // (curl, native apps) are not browsers and are unaffected.
  const untrustedOrigin = (method: string, origin: string | undefined) =>
    origin !== undefined && !SAFE_METHODS.has(method) && !trusted.has(origin);

  app.use('/api/auth/*', async (c, next) => {
    if (untrustedOrigin(c.req.method, c.req.header('origin'))) {
      return c.json({ code: 'INVALID_ORIGIN', message: 'Invalid origin' }, 403);
    }
    await next();
  });

  app.use('/v1/*', async (c, next) => {
    if (untrustedOrigin(c.req.method, c.req.header('origin'))) {
      return problem(403, 'INVALID_ORIGIN', { detail: 'Invalid origin' });
    }
    await next();
  });

  app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
    const response = await auth.handler(c.req.raw);
    // Better Auth's own limiter says how long to wait in `X-Retry-After`; HTTP clients look for `Retry-After`.
    const wait = response.headers.get('x-retry-after');
    if (response.status === 429 && wait !== null && !response.headers.has('retry-after')) {
      const headers = new Headers(response.headers);
      headers.set('retry-after', wait);
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  });

  app.openAPIRegistry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: 'globetrot.session_token',
    description:
      'The session cookie set by sign-in (`__Secure-globetrot.session_token` over https). Browsers send it by themselves.',
  });

  // The contract is public. Registered BEFORE the authentication middleware below: Hono runs middleware in
  // registration order, so everything registered after `app.use('/v1/*', ...)` requires a session.
  app.doc31('/v1/openapi.json', OPENAPI_CONFIG);
  registerProviderRoutes(app, enabledProviders);

  // A shared trip is public: anyone with the link may read it, so it is registered before the session middleware.
  registerSharedTripRoute(app, sharedTrips);

  // Stripe calls this with no session: it is trusted only through the signature over the raw body, so it is
  // registered before the session middleware and reads the body as text, untouched.
  app.post('/v1/webhooks/stripe', async (c) => {
    if (!paymentWebhook) return problem(404, 'NOT_FOUND');
    const status = await paymentWebhook(
      await c.req.text(),
      c.req.header('stripe-signature') ?? null,
    );
    return c.json({ received: status === 200 }, status as 200 | 400 | 404 | 500);
  });

  // The email provider posts forwarded emails here with no session: it is trusted only through the shared
  // secret in a header (compared in constant time); whose email it is comes from the address's token.
  app.post('/v1/inbound/email', async (c) => {
    if (!inboundEmail) return problem(404, 'NOT_FOUND');
    const given = Buffer.from(c.req.header('x-inbound-secret') ?? '');
    const expected = Buffer.from(inboundEmail.secret);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return problem(401, 'UNAUTHENTICATED');
    }
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const to = Array.isArray(body.ToFull) ? (body.ToFull[0] as Record<string, unknown>) : {};
    const hash =
      typeof body.MailboxHash === 'string' && body.MailboxHash
        ? body.MailboxHash
        : typeof to.MailboxHash === 'string'
          ? to.MailboxHash
          : (/\+([a-z0-9]+)@/i.exec(String(body.To ?? ''))?.[1] ?? '');
    const outcome = await inboundEmail.receive({
      token: hash.toLowerCase(),
      subject: typeof body.Subject === 'string' ? body.Subject.slice(0, 300) : '',
      text: typeof body.TextBody === 'string' ? body.TextBody.slice(0, 20_000) : '',
    });
    // Counts only in the logs: never the address, the subject or the text.
    console.info(`inbound email: ${outcome}`);
    return c.json({ outcome }, 200);
  });

  // The only place an `Actor` is created. It comes from the verified session cookie and from nothing else:
  // not a header, a query parameter or a body field. Do not read any of those here.
  app.use('/v1/*', async (c, next) => {
    const session = await auth.getSession(c.req.raw.headers);
    if (!session) throw new UnauthenticatedError();
    c.set('actor', { kind: 'user', userId: session.userId });
    await next();
  });

  app.openapi(getCurrentUserRoute, async (c) =>
    c.json(await application.getCurrentUser.execute(c.get('actor'), {}), 200),
  );

  registerPreferencesRoutes(app, application);
  registerTripRoutes(app, application);
  registerDestinationRoutes(app, application);
  registerBudgetRoutes(app, application);
  registerChecklistRoutes(app, application);
  registerDayPlaceRoutes(app, application);
  registerPlaceRoutes(app, application);
  registerCommunityRoutes(app, application);
  registerMediaRoutes(app, application);
  registerAccountRoutes(app, application);
  registerPipRoutes(app, application);
  registerBillingRoutes(app, application);
  app.openapi(inboundAddressRoute, async (c) => {
    if (!inboundEmail) return c.json({ address: null }, 200);
    const { token } = await application.getInboundToken.execute(c.get('actor'), {});
    return c.json({ address: `${inboundEmail.local}+${token}@${inboundEmail.domain}` }, 200);
  });
  registerShareRoutes(app, application);
  registerMemberRoutes(app, application);
  registerHabitRoutes(app, application);
  registerMilesRoutes(app, application);

  app.notFound(() => problem(404, 'NOT_FOUND', { detail: 'No such route' }));

  app.onError((error) => {
    if (error instanceof ApplicationError) return problemFromApplicationError(error);
    // Malformed JSON and similar errors raised by Hono itself.
    if (error instanceof HTTPException && error.status === 400) {
      return problem(400, 'BAD_REQUEST', { detail: 'The request could not be read' });
    }
    // A bug. Log the kind of error only: driver errors can quote the SQL parameters (emails, tokens).
    const code = (error as { code?: unknown }).code;
    console.error(
      `unhandled ${error.name}${typeof code === 'string' ? ` (${code})` : ''} in a request`,
    );
    onUnexpectedError(error);
    return problem(500, 'INTERNAL_ERROR');
  });

  return app;
}
