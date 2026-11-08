import { createServerApiClient, type FetchOptions } from './stored-preferences';

export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
}

/**
 * Who the session cookie belongs to, or `null` for no session, an expired one, or an API that does not answer.
 * Callers treat `null` as "not signed in".
 */
export async function fetchCurrentUser(options: FetchOptions): Promise<CurrentUser | null> {
  try {
    const { data } = await createServerApiClient(options).GET('/v1/me');
    return data ?? null;
  } catch {
    return null;
  }
}
