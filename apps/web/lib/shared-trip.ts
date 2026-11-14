import type { paths } from '@globetrot/api-client';
import { apiInternalUrl } from './api-proxy';
import { createServerApiClient } from './stored-preferences';

export type SharedTrip =
  paths['/v1/shared/{slug}']['get']['responses'][200]['content']['application/json'];

/** A shared trip for anyone with the link (no session), or null when the link does not exist. */
export async function fetchSharedTrip(slug: string): Promise<SharedTrip | null> {
  try {
    const { data } = await createServerApiClient({
      cookieHeader: '',
      apiUrl: apiInternalUrl(),
    }).GET('/v1/shared/{slug}', { params: { path: { slug } } });
    return data ?? null;
  } catch {
    return null;
  }
}

/** `2027-03` as "March 2027" in the visitor's language. */
export const formatMonth = (yyyyMm: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${yyyyMm}-15T12:00:00Z`),
  );
