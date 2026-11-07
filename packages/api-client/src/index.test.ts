import { describe, expect, it } from 'vitest';
import { createApiClient, PACKAGE_NAME } from './index';

describe('@globetrot/api-client', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@globetrot/api-client');
  });

  it('calls a typed path and reads a typed response', async () => {
    const requests: Request[] = [];
    const client = createApiClient({
      baseUrl: 'https://app.example.test',
      fetch: async (request) => {
        requests.push(request);
        return Response.json({
          id: 'u1',
          email: 'ana@example.com',
          name: 'Ana',
          emailVerified: false,
        });
      },
    });

    const { data, error } = await client.GET('/v1/me');

    expect(requests[0]?.url).toBe('https://app.example.test/v1/me');
    expect(error).toBeUndefined();
    // `data` is typed from the contract: these property reads fail to compile if the contract changes.
    expect(data?.email).toBe('ana@example.com');
    expect(data?.emailVerified).toBe(false);
  });

  it('types the error branch as the problem+json body', async () => {
    const client = createApiClient({
      baseUrl: 'https://app.example.test',
      fetch: async () =>
        new Response(
          JSON.stringify({
            type: 'urn:globetrot:problem:unauthenticated',
            title: 'Authentication required',
            status: 401,
            code: 'UNAUTHENTICATED',
          }),
          { status: 401, headers: { 'content-type': 'application/problem+json' } },
        ),
    });

    const { data, error } = await client.GET('/v1/me');

    expect(data).toBeUndefined();
    expect(error?.code).toBe('UNAUTHENTICATED');
  });

  it('refuses paths that are not in the contract at compile time', () => {
    const client = createApiClient({ baseUrl: 'https://app.example.test' });
    // Never called: this only has to fail to compile if the line below stops being an error.
    const unknownPath = () =>
      // @ts-expect-error '/v1/not-a-route' is not a path of the API
      client.GET('/v1/not-a-route');
    expect(typeof unknownPath).toBe('function');
  });
});
