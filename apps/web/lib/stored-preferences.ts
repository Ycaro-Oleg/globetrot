import { createApiClient } from '@globetrot/api-client';
import type { MotionChoice, ThemeChoice } from '@globetrot/domain';
import { isSupportedLocale } from '@globetrot/i18n';
import { isPlanRequired } from './plan-required';

/** The session cookie set by the API: with the `__Secure-` prefix over https, without it in development. */
export const SESSION_COOKIE_NAMES = [
  '__Secure-globetrot.session_token',
  'globetrot.session_token',
] as const;

export interface StoredPreferences {
  readonly locale: string;
  readonly currency: string;
  readonly homeCountry: string | null;
  readonly nationality: string | null;
  readonly timeZone: string | null;
  readonly units: 'metric' | 'imperial';
  readonly theme: ThemeChoice;
  readonly motion: MotionChoice;
  /** The city the person usually leaves from, or null. */
  readonly homeCity: string | null;
  readonly pipOptIn: boolean;
  readonly pipLook: {
    readonly hat: 'straw' | 'helmet' | 'cap' | 'none';
    readonly outfit: 'none' | 'scarf' | 'aloha' | 'vest';
    readonly bag: 'trolley' | 'backpack' | 'vintage';
    readonly bagColor: 'amber' | 'cyan' | 'pink';
  };
  readonly pipName: string | null;
}

/**
 * A `Cookie` header holding only the session cookie, or `null` for a visitor who is not signed in. Server code
 * forwards this and nothing else to the API, so no other cookie of the browser leaves the web app.
 */
export function sessionCookieHeader(
  cookies: readonly { readonly name: string; readonly value: string }[],
): string | null {
  for (const name of SESSION_COOKIE_NAMES) {
    const found = cookies.find((cookie) => cookie.name === name && cookie.value !== '');
    if (found) return `${found.name}=${found.value}`;
  }
  return null;
}

export interface FetchOptions {
  readonly cookieHeader: string;
  readonly apiUrl: string;
  readonly fetch?: typeof fetch;
  /** Rendering a page must not hang on the API. */
  readonly timeoutMs?: number;
  /**
   * Called (and expected to throw, e.g. Next's `redirect`) when the API refuses a change because the free week
   * is over. Server actions pass it so every write in a read-only account leads to the plans.
   */
  readonly onPlanRequired?: () => never;
}

/** A client for server-side calls to the API as the signed-in user: it forwards the session cookie. */
export function createServerApiClient({
  cookieHeader,
  apiUrl,
  fetch: fetchImpl = fetch,
  timeoutMs = 2000,
  onPlanRequired,
}: FetchOptions) {
  return createApiClient({
    baseUrl: apiUrl,
    fetch: (request) => {
      request.headers.set('cookie', cookieHeader);
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new DOMException('The API request timed out.', 'TimeoutError'));
        }, timeoutMs);
      });
      const response = Promise.resolve()
        .then(() => fetchImpl(new Request(request, { signal: controller.signal })))
        .then(async (answer) => {
          if (onPlanRequired && (await isPlanRequired(answer))) onPlanRequired();
          return answer;
        });
      return Promise.race([response, timedOut]).finally(() => {
        if (timeout !== undefined) clearTimeout(timeout);
      });
    },
  });
}

/**
 * The signed-in user's stored settings, or `null` when there are none to use: no session, an expired one, the
 * API being down or slow, or an answer that does not look right. Callers then fall back to the cookie
 * language and UTC, so a failing API never breaks a page.
 */
export async function fetchStoredPreferences(
  options: FetchOptions,
): Promise<StoredPreferences | null> {
  try {
    const { data } = await createServerApiClient(options).GET('/v1/me/preferences');
    if (!data || !isSupportedLocale(data.locale)) return null;
    return data;
  } catch {
    return null;
  }
}
