/**
 * Browser error monitoring (ADR-0021): only with `NEXT_PUBLIC_SENTRY_DSN` (a build argument). The SDK is loaded
 * on demand, so pages without it carry none of its code, and nothing personal is sent.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import('@sentry/nextjs').then((Sentry) => Sentry.init({ dsn, tracesSampleRate: 0 }));
}
