import { createApplication } from '@globetrot/application';
import { createFakePorts } from '@globetrot/application/testing';
import { describe, expect, it } from 'vitest';
import { createApp, type AuthService } from './app';

const auth: AuthService = {
  async handler() {
    return new Response('{}');
  },
  async getSession() {
    return null;
  },
};

const app = (enabledProviders?: readonly 'google'[]) =>
  createApp({
    auth,
    application: createApplication(createFakePorts().ports),
    trustedOrigins: [],
    ...(enabledProviders === undefined ? {} : { enabledProviders }),
  });

describe('GET /v1/auth/providers', () => {
  it('is public: the sign-in screens ask it before anyone is signed in', async () => {
    const response = await app().request('/v1/auth/providers');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('lists no provider until one is configured, so no button is offered that cannot work', async () => {
    expect(await (await app().request('/v1/auth/providers')).json()).toEqual({ providers: [] });
  });

  it('lists the providers that are configured', async () => {
    expect(await (await app(['google']).request('/v1/auth/providers')).json()).toEqual({
      providers: ['google'],
    });
  });

  it('is in the OpenAPI document and the rest of /v1 still needs a session', async () => {
    const document = (await (await app().request('/v1/openapi.json')).json()) as {
      paths: Record<string, Record<string, { operationId: string }>>;
    };
    expect(document.paths['/v1/auth/providers']?.get?.operationId).toBe('listAuthProviders');
    expect((await app().request('/v1/me')).status).toBe(401);
  });
});
