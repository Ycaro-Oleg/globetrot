import { createApiClient } from '@globetrot/api-client';

export type SocialProvider = 'google';

/**
 * The social sign-in buttons to offer, from `GET /v1/auth/providers`. Any trouble (the API is down or slow, an
 * unexpected answer) means none: the page then shows email and password only, which always works, and never a
 * button that cannot.
 */
export async function fetchEnabledProviders(options: {
  apiUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Promise<readonly SocialProvider[]> {
  const { apiUrl, fetch: fetchImpl = fetch, timeoutMs = 2000 } = options;
  try {
    const client = createApiClient({
      baseUrl: apiUrl,
      fetch: (request) =>
        fetchImpl(new Request(request, { signal: AbortSignal.timeout(timeoutMs) })),
    });
    const { data } = await client.GET('/v1/auth/providers');
    return (data?.providers ?? []).filter(
      (provider): provider is SocialProvider => provider === 'google',
    );
  } catch {
    return [];
  }
}
