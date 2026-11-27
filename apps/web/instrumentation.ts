import type { captureRequestError } from '@sentry/nextjs';

/**
 * Server-side error monitoring (ADR-0021): unexpected errors in pages and server actions go to Sentry when
 * `SENTRY_DSN` is set. The SDK loads only then, and sends nothing personal (no cookies, headers or bodies).
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export async function onRequestError(...args: Parameters<typeof captureRequestError>) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
}
