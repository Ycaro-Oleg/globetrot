import { cookies } from 'next/headers';
import { cache } from 'react';
import { apiInternalUrl } from './api-proxy';
import {
  fetchStoredPreferences,
  sessionCookieHeader,
  type StoredPreferences,
} from './stored-preferences';

/**
 * The signed-in visitor's stored settings, or `null` for an anonymous one (who makes no API call). Cached for the
 * request, so the language and the appearance are read with one call however many places ask.
 */
export const getStoredPreferences = cache(async (): Promise<StoredPreferences | null> => {
  const cookieHeader = sessionCookieHeader((await cookies()).getAll());
  return cookieHeader ? fetchStoredPreferences({ cookieHeader, apiUrl: apiInternalUrl() }) : null;
});
