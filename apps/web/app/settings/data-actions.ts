'use server';

import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../lib/api-proxy';
import {
  createServerApiClient,
  SESSION_COOKIE_NAMES,
  sessionCookieHeader,
} from '../../lib/stored-preferences';

/** Deletes the account after the email was typed again; clears the session cookie. `true` when it worked. */
export async function deleteAccount(confirmEmail: string): Promise<boolean> {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  if (!cookieHeader) return false;
  const client = createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() });
  const { data } = await client.DELETE('/v1/me', { body: { confirmEmail } });
  if (!data?.ok) return false;
  for (const name of SESSION_COOKIE_NAMES) store.delete(name);
  return true;
}
