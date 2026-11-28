'use server';

import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../lib/api-proxy';
import {
  createServerApiClient,
  SESSION_COOKIE_NAMES,
  sessionCookieHeader,
} from '../../lib/stored-preferences';

/**
 * What deleting the account came to: `ok` (deleted, signed out), `unavailable` (a subscription could not be
 * canceled, so nothing was deleted: try again, #201), or `mismatch` (anything else, such as the email typed
 * differently).
 */
export type DeleteAccountResult = 'ok' | 'mismatch' | 'unavailable';

/** Deletes the account after the email was typed again; clears the session cookie when it worked. */
export async function deleteAccount(confirmEmail: string): Promise<DeleteAccountResult> {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) return 'mismatch';
  const client = createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() });
  const { data, response } = await client.DELETE('/v1/me', { body: { confirmEmail } });
  if (!data?.ok) return response.status === 503 ? 'unavailable' : 'mismatch';
  for (const name of SESSION_COOKIE_NAMES) store.delete(name);
  return 'ok';
}
