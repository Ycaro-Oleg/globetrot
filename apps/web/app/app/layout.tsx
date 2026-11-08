import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { apiInternalUrl } from '../../lib/api-proxy';
import { loginRedirect } from '../../lib/app-gate';
import { fetchCurrentUser } from '../../lib/current-user';
import { sessionCookieHeader } from '../../lib/stored-preferences';

// Depends on the visitor's cookies, so it is rendered per request.
export const dynamic = 'force-dynamic';

/**
 * The signed-in area. `proxy.ts` already sends visitors without a session cookie to the log-in page with the
 * page they wanted; this check catches the cookie that is stale, expired or revoked (for example after a
 * password reset ended the session), which only the API can tell.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const user = cookieHeader
    ? await fetchCurrentUser({ cookieHeader, apiUrl: apiInternalUrl() })
    : null;
  if (!user) redirect(loginRedirect('/app'));
  return children;
}
