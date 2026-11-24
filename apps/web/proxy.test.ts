import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

const ORIGIN = 'http://localhost:3000';

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, cookie ? { headers: { cookie } } : undefined);
}

const SESSION = 'globetrot.session_token=abc';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('proxy: the signed-in app', () => {
  it('sends a visitor without a session to log in, remembering the page', () => {
    const response = proxy(request('/app/budget?tab=1'));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/app/budget?tab=1');
  });

  it('lets a visitor with a session cookie through (the layout checks it with the API)', () => {
    const response = proxy(request('/app/budget', SESSION));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });

  it('applies to every app page, including ones that do not exist yet', () => {
    for (const path of ['/app', '/app/board', '/app/trips/123/days', '/app/whatever']) {
      expect(proxy(request(path)).status).toBe(307);
    }
  });
});

describe('proxy: pages behind the Pip flag', () => {
  it('answers like an unknown address while the flag is off', () => {
    for (const path of ['/app/pip', '/app/pip/history']) {
      const response = proxy(request(path, SESSION));
      expect(response.headers.get('x-middleware-rewrite')).toBe(`${ORIGIN}/feature-is-off`);
    }
  });

  it('lets them through when the flag is on', () => {
    vi.stubEnv('FEATURE_PIP', 'true');
    const response = proxy(request('/app/pip', SESSION));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('does not hide look-alike pages', () => {
    const response = proxy(request('/app/pipeline', SESSION));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('still asks anonymous visitors to log in first', () => {
    expect(proxy(request('/app/pip')).status).toBe(307);
  });
});

describe('proxy: the API', () => {
  it('forwards auth and /v1 requests to the API', () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000');
    const response = proxy(request('/v1/me?x=1'));
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://api.internal:4000/v1/me?x=1');
  });
});

describe('proxy: a link that names its language', () => {
  it('stores the language and renders the page in it', () => {
    const response = proxy(request('/?lang=pt-BR'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.cookies.get('globetrot_locale')?.value).toBe('pt-BR');
    expect(response.headers.get('x-middleware-override-headers')).toContain('cookie');
    expect(response.headers.get('x-middleware-request-cookie')).toContain('globetrot_locale=pt-BR');
  });

  it('ignores unsupported values and plain visits', () => {
    for (const path of ['/?lang=xx', '/signup', '/login?lang=']) {
      const response = proxy(request(path));
      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(response.cookies.get('globetrot_locale')).toBeUndefined();
    }
  });
});
