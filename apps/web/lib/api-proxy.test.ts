import { describe, expect, it } from 'vitest';
import { apiProxyTarget, DEFAULT_API_URL } from './api-proxy';

const API = 'http://api.internal:4000';
const target = (pathname: string, search = '') =>
  apiProxyTarget(pathname, search, API)?.toString() ?? null;

describe('apiProxyTarget', () => {
  it('maps auth paths onto the API, keeping the query string', () => {
    expect(target('/api/auth/get-session')).toBe('http://api.internal:4000/api/auth/get-session');
    expect(target('/api/auth/sign-in/email')).toBe(
      'http://api.internal:4000/api/auth/sign-in/email',
    );
    expect(target('/api/auth/callback/google', '?code=abc&state=xyz')).toBe(
      'http://api.internal:4000/api/auth/callback/google?code=abc&state=xyz',
    );
    expect(target('/api/auth')).toBe('http://api.internal:4000/api/auth');
  });

  it('works with the default URL, a path-less base and a trailing slash on the base', () => {
    expect(apiProxyTarget('/api/auth/get-session', '', DEFAULT_API_URL)?.toString()).toBe(
      'http://localhost:4000/api/auth/get-session',
    );
    expect(apiProxyTarget('/api/auth/x', '', 'https://api.example.test/')?.toString()).toBe(
      'https://api.example.test/api/auth/x',
    );
  });

  it.each([
    '/',
    '/app',
    '/api',
    '/api/authx',
    '/api/other',
    '/v1/me',
    '/health',
    '/api/Auth/get-session',
  ])('does not forward %s', (path) => {
    expect(target(path)).toBeNull();
  });

  it.each([
    '/api/auth/../secret',
    '/api/auth/%2e%2e/secret',
    '/api/auth/%2E%2E/secret',
    '/api/auth/./../../health',
    '/api/auth/..%2fsecret',
  ])('cannot be walked out of the prefix with %s', (path) => {
    const result = target(path);
    // Either refused, or still strictly under /api/auth on the API host.
    if (result !== null) {
      const url = new URL(result);
      expect(url.origin).toBe(API);
      expect(url.pathname === '/api/auth' || url.pathname.startsWith('/api/auth/')).toBe(true);
    }
  });

  it('never lets the request choose the host', () => {
    expect(target('//evil.example/api/auth/x')).toBeNull();
    expect(target('http://evil.example/api/auth/x')).toBeNull();
    expect(target('/\\evil.example/api/auth/x')).toBeNull();
  });

  it('fails clearly on an invalid API_INTERNAL_URL', () => {
    expect(() => apiProxyTarget('/api/auth/x', '', 'not a url')).toThrow(
      'API_INTERNAL_URL is not a valid URL',
    );
  });
});
