import { createApplication, type UserRecord } from '@globetrot/application';
import { createFakePorts } from '@globetrot/application/testing';
import { describe, expect, it } from 'vitest';
import { createApp, type AuthService } from './app';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'bruno@example.com',
  name: 'Bruno',
  emailVerified: true,
};

const auth: AuthService = {
  async handler() {
    return new Response('{}');
  },
  async getSession(headers) {
    const match = /(?:^|;\s*)session=([^;]+)/.exec(headers.get('cookie') ?? '');
    return match?.[1] ? { userId: match[1] } : null;
  },
};

function setup() {
  const fake = createFakePorts({ users: [ana, bruno] });
  const app = createApp({
    auth,
    application: createApplication(fake.ports),
    trustedOrigins: ['http://localhost:3000'],
  });
  const call = async (
    user: UserRecord | null,
    method: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await app.request('/v1/me/preferences', {
      method,
      headers: {
        ...(user ? { cookie: `session=${user.id}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    return { response, json: (await response.json()) as Record<string, unknown> };
  };
  return { ...fake, app, call };
}

describe('/v1/me/preferences', () => {
  it('needs a session', async () => {
    const { call } = setup();
    for (const method of ['GET', 'PATCH']) {
      const { response, json } = await call(
        null,
        method,
        method === 'GET' ? undefined : { units: 'metric' },
      );
      expect(response.status).toBe(401);
      expect(json.code).toBe('UNAUTHENTICATED');
    }
  });

  it('starts with USD, the default language and nothing else set', async () => {
    const { call } = setup();
    const { response, json } = await call(ana, 'GET');
    expect(response.status).toBe(200);
    expect(json).toEqual({
      locale: 'en',
      currency: 'USD',
      homeCountry: null,
      nationality: null,
      timeZone: null,
      units: 'metric',
      theme: 'system',
      motion: 'full',
      homeCity: null,
      homePoint: null,
      pipOptIn: false,
      pipLook: { hat: 'straw', outfit: 'none', bag: 'trolley', bagColor: 'amber' },
      pipName: null,
    });
  });

  it('changes only what is sent', async () => {
    const { call } = setup();
    await call(ana, 'PATCH', { currency: 'EUR', homeCountry: 'PT', timeZone: 'Europe/Lisbon' });
    const { json } = await call(ana, 'PATCH', { locale: 'pt-BR' });
    expect(json).toEqual({
      locale: 'pt-BR',
      currency: 'EUR',
      homeCountry: 'PT',
      nationality: null,
      timeZone: 'Europe/Lisbon',
      units: 'metric',
      theme: 'system',
      motion: 'full',
      homeCity: null,
      homePoint: null,
      pipOptIn: false,
      pipLook: { hat: 'straw', outfit: 'none', bag: 'trolley', bagColor: 'amber' },
      pipName: null,
    });
    expect((await call(ana, 'PATCH', { homeCountry: null })).json).toMatchObject({
      homeCountry: null,
      currency: 'EUR',
    });
  });

  it.each([
    ['an unknown language', { locale: 'fr' }, 'locale'],
    ['an unknown currency', { currency: 'XXX' }, 'currency'],
    ['an unknown country', { nationality: 'ZZ' }, 'nationality'],
    ['an unknown time zone', { timeZone: 'Mars/Olympus' }, 'timeZone'],
    ['an unknown unit system', { units: 'nautical' }, 'units'],
    ['an unknown theme', { theme: 'night' }, 'theme'],
    ['an unknown motion setting', { motion: 'none' }, 'motion'],
    ['a cleared language', { locale: null }, 'locale'],
  ])('rejects %s with 422 problem+json naming the field', async (_name, body, field) => {
    const { call } = setup();
    const { response, json } = await call(ana, 'PATCH', body);
    expect(response.status).toBe(422);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(json).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect((json.errors as { field: string }[]).map((error) => error.field)).toContain(field);
  });

  it('rejects an empty update with 422', async () => {
    const { call } = setup();
    const { response, json } = await call(ana, 'PATCH', {});
    expect(response.status).toBe(422);
    expect(json.code).toBe('VALIDATION_FAILED');
  });

  it('cannot be aimed at another user by body, query or headers', async () => {
    const { call } = setup();
    await call(bruno, 'PATCH', { currency: 'JPY' });
    await call(
      ana,
      'PATCH',
      { currency: 'EUR', userId: 'u-bruno' },
      {
        'x-user-id': 'u-bruno',
        authorization: 'Bearer u-bruno',
      },
    );
    expect((await call(bruno, 'GET')).json.currency).toBe('JPY');
    expect((await call(ana, 'GET')).json.currency).toBe('EUR');
  });

  it('refuses a state-changing request from an untrusted origin', async () => {
    const { call, state } = setup();
    const { response, json } = await call(
      ana,
      'PATCH',
      { currency: 'EUR' },
      {
        origin: 'https://evil.example',
      },
    );
    expect(response.status).toBe(403);
    expect(json.code).toBe('INVALID_ORIGIN');
    expect(state.preferences.size).toBe(0);
  });

  it('is described in the OpenAPI document', async () => {
    const { app } = setup();
    const response = await app.request('/v1/openapi.json');
    const document = (await response.json()) as {
      paths: Record<string, Record<string, { operationId: string }>>;
    };
    expect(document.paths['/v1/me/preferences']?.get?.operationId).toBe('getPreferences');
    expect(document.paths['/v1/me/preferences']?.patch?.operationId).toBe('updatePreferences');
  });
});
