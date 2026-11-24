import { describe, expect, it } from 'vitest';
import {
  fetchStoredPreferences,
  sessionCookieHeader,
  type StoredPreferences,
} from './stored-preferences';

const STORED: StoredPreferences = {
  locale: 'pt-BR',
  currency: 'EUR',
  homeCountry: 'BR',
  nationality: null,
  timeZone: 'America/Sao_Paulo',
  units: 'metric',
  theme: 'system',
  motion: 'full',
  homeCity: null,
  pipOptIn: false,
  pipLook: { hat: 'straw', outfit: 'none', bag: 'trolley', bagColor: 'amber' },
  pipName: null,
};

describe('sessionCookieHeader', () => {
  it('forwards only the session cookie', () => {
    expect(
      sessionCookieHeader([
        { name: 'globetrot_locale', value: 'en' },
        { name: 'globetrot.session_token', value: 'abc.def' },
        { name: 'analytics', value: 'x' },
      ]),
    ).toBe('globetrot.session_token=abc.def');
  });

  it('prefers the __Secure- cookie used over https', () => {
    expect(
      sessionCookieHeader([
        { name: 'globetrot.session_token', value: 'old' },
        { name: '__Secure-globetrot.session_token', value: 'new' },
      ]),
    ).toBe('__Secure-globetrot.session_token=new');
  });

  it('is null for a visitor who is not signed in', () => {
    expect(sessionCookieHeader([])).toBeNull();
    expect(sessionCookieHeader([{ name: 'globetrot_locale', value: 'en' }])).toBeNull();
    expect(sessionCookieHeader([{ name: 'globetrot.session_token', value: '' }])).toBeNull();
  });
});

describe('fetchStoredPreferences', () => {
  const run = (fetchImpl: typeof fetch, extra: { timeoutMs?: number } = {}) =>
    fetchStoredPreferences({
      cookieHeader: 'globetrot.session_token=abc',
      apiUrl: 'http://api.internal:4000',
      fetch: fetchImpl,
      ...extra,
    });

  it('asks the API for /v1/me/preferences with the session cookie and nothing else', async () => {
    const seen: Request[] = [];
    const result = await run(async (input) => {
      seen.push(input as Request);
      return Response.json(STORED);
    });
    expect(result).toEqual(STORED);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('http://api.internal:4000/v1/me/preferences');
    expect(seen[0]?.headers.get('cookie')).toBe('globetrot.session_token=abc');
  });

  it('is null when the session is not valid', async () => {
    const result = await run(async () =>
      Response.json({ code: 'UNAUTHENTICATED' }, { status: 401 }),
    );
    expect(result).toBeNull();
  });

  it('is null when the API is unreachable', async () => {
    expect(
      await run(async () => {
        throw new TypeError('fetch failed');
      }),
    ).toBeNull();
  });

  it('gives up on a slow API instead of hanging the page', async () => {
    const slow: typeof fetch = (input) =>
      new Promise((_resolve, reject) => {
        (input as Request).signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    expect(await run(slow, { timeoutMs: 20 })).toBeNull();
  });

  it('ignores a language it does not support', async () => {
    expect(await run(async () => Response.json({ ...STORED, locale: 'fr' }))).toBeNull();
  });
});
