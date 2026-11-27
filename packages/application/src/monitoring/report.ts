/**
 * Error monitoring for the API and the worker (ADR-0021), without an SDK: one unexpected error becomes one Sentry
 * event sent to the DSN's envelope endpoint. Only the error's type, message and stack frames leave, with the
 * environment; never a request, a user, a cookie or a value. A failure to send is ignored: monitoring must never
 * break the app.
 */
export interface ErrorReporter {
  report(error: unknown): void;
}

interface ParsedDsn {
  readonly endpoint: string;
  readonly publicKey: string;
}

export function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, '').split('/').pop();
    if (!url.username || !projectId) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

/** Stack frames, oldest call first, as Sentry expects; only file, function, line and column. */
export function stackFrames(stack: string | undefined) {
  if (!stack) return [];
  const frames = stack
    .split('\n')
    .slice(1)
    .map((line) => /at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      function: match[1] ?? '?',
      filename: match[2],
      lineno: Number(match[3]),
      colno: Number(match[4]),
      in_app: !match[2]!.includes('node_modules'),
    }));
  return frames.reverse();
}

export function createErrorReporter(options: {
  readonly dsn: string | null;
  readonly environment: string;
  readonly service: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly newId?: () => string;
}): ErrorReporter {
  const parsed = options.dsn ? parseDsn(options.dsn) : null;
  if (!parsed) return { report: () => {} };
  const send = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID().replace(/-/g, ''));
  return {
    report(error) {
      const value = error instanceof Error ? error : new Error('Non-error thrown');
      const eventId = newId();
      const sentAt = now().toISOString();
      const event = {
        event_id: eventId,
        timestamp: sentAt,
        platform: 'node',
        level: 'error',
        environment: options.environment,
        tags: { service: options.service },
        exception: {
          values: [
            {
              type: value.name,
              value: value.message,
              stacktrace: { frames: stackFrames(value.stack) },
            },
          ],
        },
      };
      const body = [
        JSON.stringify({ event_id: eventId, sent_at: sentAt }),
        JSON.stringify({ type: 'event' }),
        JSON.stringify(event),
      ].join('\n');
      void send(parsed.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-sentry-envelope',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=globetrot/1.0`,
        },
        body,
      }).catch(() => {});
    },
  };
}
