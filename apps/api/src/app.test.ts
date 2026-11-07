import { createApplication, type UserReader, type UserRecord } from '@globetrot/application';
import { createFakePorts } from '@globetrot/application/testing';
import { describe, expect, it, vi } from 'vitest';
import { createApp, type AuthService } from './app';

const WEB = 'http://localhost:3000';
const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'bruno@example.com',
  name: 'Bruno',
  emailVerified: false,
};

const seen: Request[] = [];
/** Sessions are cookies of the form `session=<user id>`: a stand-in for Better Auth in unit tests. */
const auth: AuthService = {
  async handler(request) {
    seen.push(request);
    return new Response(JSON.stringify({ handled: new URL(request.url).pathname }), {
      headers: { 'content-type': 'application/json' },
    });
  },
  async getSession(headers) {
    const match = /(?:^|;\s*)session=([^;]+)/.exec(headers.get('cookie') ?? '');
    return match?.[1] ? { userId: match[1] } : null;
  },
};

const findById = vi.fn(
  async (userId: string) => [ana, bruno].find((user) => user.id === userId) ?? null,
);
const app = (users: UserReader = { findById }) =>
  createApp({
    auth,
    application: createApplication({ ...createFakePorts().ports, users }),
    trustedOrigins: [WEB, 'https://preview.example.test'],
  });

describe('api app', () => {
  it('reports health without touching auth', async () => {
    const before = seen.length;
    const res = await app().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', service: 'api' });
    expect(seen.length).toBe(before);
  });

  it.each([
    ['GET', '/api/auth/get-session'],
    ['POST', '/api/auth/sign-in/email'],
    ['POST', '/api/auth/sign-out'],
  ])('hands %s %s to the auth handler', async (method, path) => {
    const res = await app().request(path, { method });
    expect(await res.json()).toEqual({ handled: path });
  });

  it('does not expose auth under other prefixes or methods', async () => {
    expect((await app().request('/auth/get-session')).status).toBe(404);
    expect((await app().request('/api/auth/get-session', { method: 'DELETE' })).status).toBe(404);
  });

  it('answers an unknown route with problem+json, not an HTML or empty page', async () => {
    const res = await app().request('/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('origin check on state-changing requests', () => {
  const post = (origin?: string, method = 'POST') =>
    app().request('/api/auth/sign-in/email', {
      method,
      headers: origin === undefined ? {} : { origin },
    });

  it.each([WEB, 'https://preview.example.test'])(
    'lets the trusted origin %s through',
    async (origin) => {
      const before = seen.length;
      expect((await post(origin)).status).toBe(200);
      expect(seen.length).toBe(before + 1);
    },
  );

  it('lets requests without an Origin through, since they do not come from a browser page', async () => {
    expect((await post()).status).toBe(200);
  });

  it.each([
    'https://evil.example',
    'null',
    'http://localhost:3001',
    'https://localhost:3000',
    'http://localhost',
    'http://LOCALHOST:3000.evil.example',
  ])('refuses %s before it reaches auth', async (origin) => {
    const before = seen.length;
    const res = await post(origin);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'INVALID_ORIGIN' });
    expect(seen.length).toBe(before);
  });

  it('only applies to methods that change state', async () => {
    const res = await app().request('/api/auth/get-session', {
      headers: { origin: 'https://evil.example' },
    });
    expect(res.status).toBe(200);
  });

  it('also guards /v1, answering in problem+json', async () => {
    const res = await app().request('/v1/me', {
      method: 'POST',
      headers: { origin: 'https://evil.example', cookie: 'session=u-ana' },
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'INVALID_ORIGIN' });
  });
});

describe('GET /v1/me', () => {
  const me = async (init: RequestInit & { cookie?: string } = {}) => {
    const { cookie, headers, ...rest } = init;
    return app().request('/v1/me', {
      ...rest,
      headers: { ...(cookie ? { cookie } : {}), ...(headers as Record<string, string>) },
    });
  };

  it('refuses an anonymous caller with problem+json and does not read any user', async () => {
    findById.mockClear();
    const res = await me();
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toEqual({
      type: 'urn:globetrot:problem:unauthenticated',
      title: 'Authentication required',
      status: 401,
      code: 'UNAUTHENTICATED',
      detail: 'Authentication is required',
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('refuses a cookie that does not name a session', async () => {
    expect((await me({ cookie: 'other=u-ana' })).status).toBe(401);
  });

  it('returns only id, email, name and the verification flag of the caller', async () => {
    const res = await me({ cookie: 'session=u-ana' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ana);
  });

  it('cannot be told who the caller is by headers, query string or body', async () => {
    const attempts: RequestInit[] = [
      { headers: { 'x-user-id': 'u-bruno' } },
      { headers: { 'x-actor': JSON.stringify({ kind: 'user', userId: 'u-bruno' }) } },
      { headers: { authorization: 'Bearer u-bruno' } },
      { headers: { 'x-forwarded-user': 'u-bruno', 'x-actor-id': 'u-bruno' } },
    ];
    for (const attempt of attempts) {
      const res = await me({ cookie: 'session=u-ana', ...attempt });
      expect((await res.json()) as UserRecord).toMatchObject({ id: 'u-ana' });
    }
    const viaQuery = await app().request('/v1/me?userId=u-bruno&actor=u-bruno', {
      headers: { cookie: 'session=u-ana' },
    });
    expect(((await viaQuery.json()) as UserRecord).id).toBe('u-ana');
  });

  it('does not let identity headers stand in for a missing session', async () => {
    const res = await me({ headers: { 'x-user-id': 'u-ana', authorization: 'Bearer u-ana' } });
    expect(res.status).toBe(401);
  });

  it('gives two users their own data and never the other’s', async () => {
    const [a, b] = await Promise.all([
      me({ cookie: 'session=u-ana' }).then((r) => r.json() as Promise<UserRecord>),
      me({ cookie: 'session=u-bruno' }).then((r) => r.json() as Promise<UserRecord>),
    ]);
    expect(a.email).toBe('ana@example.com');
    expect(b.email).toBe('bruno@example.com');
  });

  it('answers 404 problem+json when the session’s account is gone', async () => {
    const res = await me({ cookie: 'session=u-deleted' });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers 500 without details, and without logging what the driver said', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const failing = {
        findById: async () => {
          throw Object.assign(new Error('select * from user where email = ana@example.com'), {
            code: '57P01',
          });
        },
      };
      const res = await app(failing).request('/v1/me', { headers: { cookie: 'session=u-ana' } });
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
      expect(text).not.toMatch(/select|ana@example|stack| at /i);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/select|ana@example/);
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });

  it('requires a session for every /v1 path except the contract', async () => {
    expect((await app().request('/v1/anything')).status).toBe(401);
    expect((await app().request('/v1/openapi.json')).status).toBe(200);
  });
});

describe('GET /v1/openapi.json', () => {
  it('is public and describes /v1/me', async () => {
    const res = await app().request('/v1/openapi.json');
    const document = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths)).toContain('/v1/me');
  });
});
