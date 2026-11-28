/**
 * The interest list (#191, ADR-0037): visitors without an account leave an email, confirm it, and can leave in
 * one click. Talks to the public `/v1/leads` routes (`docs/architecture/api-contracts.md`, "The interest list").
 * The browser calls the web origin, which proxies `/v1/*`; the confirm page calls the API from the server.
 */

export type LeadSource = 'landing' | 'itinerary';
export type ListLocale = 'en' | 'pt-BR';

export interface LeadOrigin {
  readonly utm_source?: string;
  readonly utm_medium?: string;
  readonly utm_campaign?: string;
  readonly referrer_domain?: string;
  readonly landing_path?: string;
}

export interface JoinRequest {
  readonly email: string;
  readonly locale: ListLocale;
  readonly consent: true;
  readonly source: LeadSource;
  readonly origin?: LeadOrigin;
  readonly internal?: boolean;
}

export type JoinOutcome =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'invalid'; readonly field: 'email' | 'consent' | 'other' }
  | { readonly kind: 'rate-limited'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'error' };

export type ConfirmResult = 'confirmed' | 'already_confirmed' | 'expired' | 'not_found';

/** A token from a list email: what the API accepts, so a malformed one never leaves the page. */
export const LEAD_TOKEN_PATTERN = /^[A-Za-z0-9_.-]{20,200}$/;

/** The language a list page is shown in: the email's `lang`, when it is one the app speaks. */
export function listLocale(value: unknown): ListLocale | null {
  return value === 'en' || value === 'pt-BR' ? value : null;
}

const json = { 'content-type': 'application/json', accept: 'application/json' };

/** Asks to join. Every valid request is accepted the same way: the answer never says whether the address was known. */
export async function joinInterestList(
  request: JoinRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<JoinOutcome> {
  try {
    const response = await fetchImpl('/v1/leads', {
      method: 'POST',
      headers: json,
      body: JSON.stringify(request),
    });
    if (response.status === 202 || response.ok) return { kind: 'accepted' };
    if (response.status === 422) {
      const problem = (await response.json().catch(() => null)) as {
        errors?: { field?: string }[];
      } | null;
      const field = problem?.errors?.[0]?.field;
      return { kind: 'invalid', field: field === 'email' || field === 'consent' ? field : 'other' };
    }
    if (response.status === 429) {
      const seconds = Number(response.headers.get('retry-after'));
      return {
        kind: 'rate-limited',
        retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      };
    }
    return { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

const CONFIRM_RESULTS: readonly ConfirmResult[] = [
  'confirmed',
  'already_confirmed',
  'expired',
  'not_found',
];

/**
 * Confirms an entry from its email link (the server calls the API directly). A malformed token is "not found"
 * without asking; `null` when the API does not answer, so the page can say "try again" instead of guessing.
 */
export async function confirmInterest(
  token: unknown,
  options: { apiUrl: string; fetch?: typeof fetch; timeoutMs?: number },
): Promise<{ result: ConfirmResult; internal: boolean } | null> {
  if (typeof token !== 'string' || !LEAD_TOKEN_PATTERN.test(token)) {
    return { result: 'not_found', internal: false };
  }
  try {
    const response = await (options.fetch ?? fetch)(
      new Request(new URL('/v1/leads/confirm', options.apiUrl), {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
      }),
    );
    if (response.status === 422) return { result: 'not_found', internal: false };
    if (!response.ok) return null;
    const body = (await response.json()) as { result?: unknown; internal?: unknown };
    return CONFIRM_RESULTS.includes(body.result as ConfirmResult)
      ? { result: body.result as ConfirmResult, internal: body.internal === true }
      : null;
  } catch {
    return null;
  }
}

/** Leaves the list (the page's button, never on page load). `true` once the API says so. */
export async function leaveInterestList(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!LEAD_TOKEN_PATTERN.test(token)) return false;
  try {
    const response = await fetchImpl('/v1/leads/unsubscribe', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { result?: unknown };
    return body.result === 'unsubscribed';
  } catch {
    return false;
  }
}
