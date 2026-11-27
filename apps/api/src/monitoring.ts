import { createErrorReporter, type ErrorReporter } from '@globetrot/application';

/**
 * Error monitoring (ADR-0021): unexpected errors go to Sentry when `SENTRY_DSN` is set, and nowhere otherwise.
 * Only the error, its stack and the environment leave; never a request, a user or a value.
 */
let reporter: ErrorReporter = { report: () => {} };

export function initMonitoring(dsn: string | null, environment: string): void {
  reporter = createErrorReporter({ dsn, environment, service: 'api' });
}

/** Sends one unexpected error, when monitoring is on. */
export function reportError(error: unknown): void {
  reporter.report(error);
}
