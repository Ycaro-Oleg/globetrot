import { describe, expect, it } from 'vitest';
import { createApp, type AuthHandler } from './app';

const WEB = 'http://localhost:3000';
const seen: Request[] = [];
const auth: AuthHandler = {
  async handler(request) {
    seen.push(request);
    return new Response(JSON.stringify({ handled: new URL(request.url).pathname }), {
      headers: { 'content-type': 'application/json' },
    });
  },
};
const app = () => createApp({ auth, trustedOrigins: [WEB, 'https://preview.example.test'] });

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
});
