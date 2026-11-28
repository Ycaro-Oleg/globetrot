import { describe, expect, it, vi } from 'vitest';
import {
  confirmInterest,
  joinInterestList,
  leaveInterestList,
  listLocale,
  type JoinRequest,
} from './leads';

// A stand-in for #191's API until that PR merges (contract: docs/architecture/api-contracts.md).
const problem = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/problem+json', ...headers },
  });

const REQUEST: JoinRequest = {
  email: 'someone@example.com',
  locale: 'pt-BR',
  consent: true,
  source: 'landing',
};
const TOKEN = 'abcdefghij_KLMNOPQRS-1234.xyz';

describe('joinInterestList', () => {
  it('posts the request to the web origin and reads 202 as accepted', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ accepted: true }, { status: 202 }));
    expect(await joinInterestList(REQUEST, fetchImpl)).toEqual({ kind: 'accepted' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/v1/leads');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(REQUEST);
  });

  it('names the field a 422 refuses', async () => {
    const answer = (field: string) => async () =>
      problem(422, { code: 'VALIDATION_FAILED', errors: [{ field }] });
    expect(await joinInterestList(REQUEST, answer('email'))).toEqual({
      kind: 'invalid',
      field: 'email',
    });
    expect(await joinInterestList(REQUEST, answer('consent'))).toEqual({
      kind: 'invalid',
      field: 'consent',
    });
    expect(await joinInterestList(REQUEST, answer('origin.landing_path'))).toEqual({
      kind: 'invalid',
      field: 'other',
    });
  });

  it('reads 429 with its Retry-After', async () => {
    expect(
      await joinInterestList(REQUEST, async () =>
        problem(429, { code: 'RATE_LIMITED' }, { 'retry-after': '120' }),
      ),
    ).toEqual({ kind: 'rate-limited', retryAfterSeconds: 120 });
    expect(
      await joinInterestList(REQUEST, async () => problem(429, { code: 'RATE_LIMITED' })),
    ).toEqual({ kind: 'rate-limited', retryAfterSeconds: null });
  });

  it('is an error for anything else, including no answer', async () => {
    expect(await joinInterestList(REQUEST, async () => problem(500, {}))).toEqual({
      kind: 'error',
    });
    expect(
      await joinInterestList(REQUEST, async () => {
        throw new TypeError('offline');
      }),
    ).toEqual({ kind: 'error' });
  });
});

describe('confirmInterest', () => {
  const apiUrl = 'http://api.internal:4000';

  it('asks the API with the token and reads its result', async () => {
    const seen: Request[] = [];
    const answer = await confirmInterest(TOKEN, {
      apiUrl,
      fetch: async (input) => {
        seen.push(input as Request);
        return Response.json({ result: 'confirmed', internal: false });
      },
    });
    expect(answer).toEqual({ result: 'confirmed', internal: false });
    expect(seen[0]?.url).toBe('http://api.internal:4000/v1/leads/confirm');
    expect(seen[0]?.method).toBe('POST');
    expect(await seen[0]?.json()).toEqual({ token: TOKEN });
  });

  it('keeps the internal flag', async () => {
    expect(
      await confirmInterest(TOKEN, {
        apiUrl,
        fetch: async () => Response.json({ result: 'already_confirmed', internal: true }),
      }),
    ).toEqual({ result: 'already_confirmed', internal: true });
  });

  it('never sends a malformed token, and reads a refused one as not found', async () => {
    const fetchImpl = vi.fn();
    for (const token of [
      undefined,
      ['a'],
      'short',
      'has spaces in it but is long enough',
      'x'.repeat(201),
    ]) {
      expect(await confirmInterest(token, { apiUrl, fetch: fetchImpl })).toEqual({
        result: 'not_found',
        internal: false,
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await confirmInterest(TOKEN, { apiUrl, fetch: async () => problem(422, {}) })).toEqual({
      result: 'not_found',
      internal: false,
    });
  });

  it('is null when the API does not answer or answers something else', async () => {
    expect(
      await confirmInterest(TOKEN, { apiUrl, fetch: async () => problem(500, {}) }),
    ).toBeNull();
    expect(
      await confirmInterest(TOKEN, { apiUrl, fetch: async () => Response.json({ result: 'ok' }) }),
    ).toBeNull();
    expect(
      await confirmInterest(TOKEN, {
        apiUrl,
        fetch: async () => {
          throw new TypeError('fetch failed');
        },
      }),
    ).toBeNull();
  });
});

describe('leaveInterestList', () => {
  it('posts the token and is true once the API says unsubscribed', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ result: 'unsubscribed' }));
    expect(await leaveInterestList(TOKEN, fetchImpl)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/v1/leads/unsubscribe');
    expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN });
  });

  it('is false for a malformed token (without asking), a refusal or no answer', async () => {
    const fetchImpl = vi.fn();
    expect(await leaveInterestList('short', fetchImpl)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await leaveInterestList(TOKEN, async () => problem(422, {}))).toBe(false);
    expect(
      await leaveInterestList(TOKEN, async () => {
        throw new TypeError('offline');
      }),
    ).toBe(false);
  });
});

describe('listLocale', () => {
  it('takes only the languages the app speaks', () => {
    expect(listLocale('pt-BR')).toBe('pt-BR');
    expect(listLocale('en')).toBe('en');
    expect(listLocale('fr')).toBeNull();
    expect(listLocale(['en'])).toBeNull();
  });
});
