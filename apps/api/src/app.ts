import { Hono } from 'hono';

/** What the HTTP layer needs from the auth library: a Web `Request` in, a `Response` out. */
export interface AuthHandler {
  handler(request: Request): Promise<Response>;
}

export interface AppDependencies {
  readonly auth: AuthHandler;
  /** Origins (scheme + host + port) allowed to send state-changing browser requests. */
  readonly trustedOrigins: readonly string[];
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Builds the HTTP app. Routes stay thin: they delegate to @globetrot/application (ADR-0006) or, for
 * sign-in and sessions, to Better Auth. The browser never calls this app directly: the web app proxies
 * `/api/auth/*` to it so the session cookie stays first-party (docs/architecture/authentication.md).
 */
export function createApp({ auth, trustedOrigins }: AppDependencies) {
  const app = new Hono();
  const trusted = new Set(trustedOrigins);

  app.get('/health', (c) => c.json({ status: 'ok', service: 'api' }));

  // Cross-site request forgery: a browser always sends `Origin` on a cross-site POST. Better Auth only
  // checks it for requests that carry cookies, which would still let a hostile page start a sign-in or
  // sign-up in the victim's browser (login CSRF). So any state-changing request that names an origin we
  // do not trust is refused here. Clients that send no `Origin` (curl, native apps) are not browsers
  // and are unaffected.
  app.use('/api/auth/*', async (c, next) => {
    const origin = c.req.header('origin');
    if (origin !== undefined && !SAFE_METHODS.has(c.req.method) && !trusted.has(origin)) {
      return c.json({ code: 'INVALID_ORIGIN', message: 'Invalid origin' }, 403);
    }
    await next();
  });

  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  return app;
}
