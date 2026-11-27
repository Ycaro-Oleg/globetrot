import { describe, expect, it, vi } from 'vitest';
import { createErrorReporter, parseDsn, stackFrames } from './report';

const dsn = 'https://abc123@o42.ingest.sentry.io/4507';

describe('error reporter', () => {
  it('reads a DSN into the envelope endpoint and the public key, and refuses a broken one', () => {
    expect(parseDsn(dsn)).toEqual({
      endpoint: 'https://o42.ingest.sentry.io/api/4507/envelope/',
      publicKey: 'abc123',
    });
    expect(parseDsn('not a url')).toBeNull();
    expect(parseDsn('https://o42.ingest.sentry.io/4507')).toBeNull();
  });

  it('turns a stack into frames, oldest first', () => {
    const frames = stackFrames(
      'Error: boom\n    at inner (/app/dist/a.js:10:5)\n    at /app/node_modules/x/b.js:2:1',
    );
    expect(frames.map((frame) => [frame.function, frame.lineno, frame.in_app])).toEqual([
      ['?', 2, false],
      ['inner', 10, true],
    ]);
  });

  it('sends one event with the error only, and does nothing without a DSN', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    const reporter = createErrorReporter({
      dsn,
      environment: 'production',
      service: 'api',
      fetch: fetch as unknown as typeof globalThis.fetch,
      now: () => new Date('2026-11-27T12:00:00Z'),
      newId: () => 'e1',
    });
    reporter.report(new TypeError('Cannot read properties of undefined'));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://o42.ingest.sentry.io/api/4507/envelope/');
    expect((init.headers as Record<string, string>)['x-sentry-auth']).toContain(
      'sentry_key=abc123',
    );
    const [, , event] = String(init.body)
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(event).toMatchObject({
      event_id: 'e1',
      environment: 'production',
      tags: { service: 'api' },
      exception: { values: [{ type: 'TypeError', value: 'Cannot read properties of undefined' }] },
    });
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();

    const off = vi.fn();
    createErrorReporter({ dsn: null, environment: 'test', service: 'api', fetch: off }).report(
      new Error('x'),
    );
    expect(off).not.toHaveBeenCalled();
  });
});
