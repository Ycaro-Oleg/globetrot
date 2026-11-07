import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import {
  ApplicationError,
  UnauthenticatedError,
  currentUserSchema,
  type Actor,
  type Application,
} from '@globetrot/application';
import { HTTPException } from 'hono/http-exception';
import {
  problem,
  problemFromApplicationError,
  problemSchema,
  PROBLEM_CONTENT_TYPE,
} from './problem';

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
}

interface Env {
  Variables: { actor: Actor };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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

const problemResponse = (description: string) => ({
  description,
  content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
});

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
export function createApp({ auth, application, trustedOrigins }: AppDependencies) {
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

  app.get('/health', (c) => c.json({ status: 'ok', service: 'api' }));

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

  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

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
    return problem(500, 'INTERNAL_ERROR');
  });

  return app;
}
