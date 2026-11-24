import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiInternalUrl } from './api-proxy';
import { PLAN_REQUIRED_PATH } from './plan-required';
import { createServerApiClient, sessionCookieHeader } from './stored-preferences';

/**
 * The API client for server actions, as the signed-in user, or `null` without a session. A change the
 * read-only account cannot save (`402 PLAN_REQUIRED`) redirects to the plans instead of failing silently.
 */
export async function actionApiClient() {
  const store = await cookies();
  const cookieHeader = sessionCookieHeader(store.getAll());
  return cookieHeader
    ? createServerApiClient({
        cookieHeader,
        apiUrl: apiInternalUrl(),
        onPlanRequired: () => redirect(PLAN_REQUIRED_PATH),
      })
    : null;
}
